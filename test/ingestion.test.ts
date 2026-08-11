import { describe, it, expect, beforeEach } from "vitest";

import {
  CONNECTED,
  DISCONNECTED,
  flushPendingUpdates,
  ingestion,
  queueVesselUpdates,
  subscription,
} from "../src/engine/ingestion.svelte";
import { vessels, vesselsState } from "../src/engine/vessels.svelte";
import type { Context, Update } from "@signalk/server-api";

const CTX = "vessels.urn:mrn:imo:mmsi:230941380" as Context;

// a signal k delta update carrying one path/value pair
function update(path: string, value: unknown, timestamp?: string): Update {
  return {
    ...(timestamp ? { timestamp } : {}),
    values: [{ path, value }],
  } as unknown as Update;
}

// queue a delta and apply it, which is what the ws handler does per message
function ingest(...updates: Update[]) {
  queueVesselUpdates(CTX, updates);
  flushPendingUpdates();
  return vessels[CTX];
}

beforeEach(() => {
  for (const key of Object.keys(vessels)) delete vessels[key as Context];
  vesselsState.myVesselContext = null;
  ingestion.connectionState = DISCONNECTED;
  flushPendingUpdates(); // drain anything a previous test queued
});

describe("queueVesselUpdates", () => {
  it("creates a vessel on first sight", () => {
    expect(vessels[CTX]).toBeUndefined();
    ingest(update("navigation.speedOverGround", 5));
    expect(vessels[CTX]).toBeDefined();
    expect(vessels[CTX].context).toBe(CTX);
  });

  it("ignores a delta with no context", () => {
    queueVesselUpdates("" as Context, [
      update("navigation.speedOverGround", 5),
    ]);
    flushPendingUpdates();
    expect(Object.keys(vessels)).toHaveLength(0);
  });

  it("ignores an empty update list", () => {
    queueVesselUpdates(CTX, []);
    flushPendingUpdates();
    expect(vessels[CTX]).toBeUndefined();
  });

  it("coalesces several deltas for one vessel before the flush", () => {
    queueVesselUpdates(CTX, [update("navigation.speedOverGround", 5)]);
    queueVesselUpdates(CTX, [update("navigation.headingTrue", 1.2)]);
    // nothing applied until the flush
    expect(vessels[CTX]).toBeUndefined();

    flushPendingUpdates();

    expect(vessels[CTX].sog).toBe(5);
    expect(vessels[CTX].hdg).toBe(1.2);
  });

  it("keeps vessels separate", () => {
    const other = "vessels.urn:mrn:imo:mmsi:111111111" as Context;
    queueVesselUpdates(CTX, [update("navigation.speedOverGround", 5)]);
    queueVesselUpdates(other, [update("navigation.speedOverGround", 9)]);
    flushPendingUpdates();

    expect(vessels[CTX].sog).toBe(5);
    expect(vessels[other].sog).toBe(9);
  });
});

describe("flushPendingUpdates", () => {
  it("drains the queue, so a second flush changes nothing", () => {
    ingest(update("navigation.speedOverGround", 5));
    vessels[CTX].sog = 99;

    flushPendingUpdates();

    expect(vessels[CTX].sog).toBe(99);
  });

  it("is safe with an empty queue", () => {
    expect(() => flushPendingUpdates()).not.toThrow();
  });
});

describe("static vessel data on the empty path", () => {
  it("reads mmsi, name, callsign and imo", () => {
    const v = ingest(
      update("", {
        mmsi: "230941380",
        name: "FINNFUN",
        communication: { callsignVhf: "OJ6852" },
        registrations: { imo: "IMO 9319466" },
      }),
    );

    expect(v.mmsi).toBe("230941380");
    expect(v.name).toBe("FINNFUN");
    expect(v.callsign).toBe("OJ6852");
    // the "IMO " prefix signal k includes is stripped
    expect(v.imo).toBe("9319466");
  });

  it("strips the imo prefix whatever its case", () => {
    expect(
      ingest(update("", { registrations: { imo: "imo 9319466" } })).imo,
    ).toBe("9319466");
  });

  it("takes several static fields from one value", () => {
    const v = ingest(update("", { mmsi: "1", name: "BOTH" }));
    expect(v.mmsi).toBe("1");
    expect(v.name).toBe("BOTH");
  });

  it("leaves absent fields alone rather than blanking them", () => {
    ingest(update("", { mmsi: "230941380", name: "FINNFUN" }));
    const v = ingest(update("", { mmsi: "230941380" }));
    expect(v.name).toBe("FINNFUN");
  });

  it("survives a static value with no recognised fields", () => {
    expect(() => ingest(update("", { somethingElse: true }))).not.toThrow();
  });
});

describe("navigation paths", () => {
  it("reads a position and stamps when it was seen", () => {
    const when = "2026-08-12T10:00:00.000Z";
    const v = ingest(
      update(
        "navigation.position",
        { latitude: 59.72, longitude: 24.73 },
        when,
      ),
    );

    expect(v.latitude).toBe(59.72);
    expect(v.longitude).toBe(24.73);
    expect(v.lastSeenDate?.toISOString()).toBe(when);
  });

  it("falls back to now when the delta carries no timestamp", () => {
    const before = Date.now();
    const v = ingest(
      update("navigation.position", { latitude: 1, longitude: 2 }),
    );
    expect(v.lastSeenDate!.getTime()).toBeGreaterThanOrEqual(before);
  });

  it("reads course, speed and heading", () => {
    const v = ingest(
      update("navigation.courseOverGroundTrue", 1.5),
      update("navigation.speedOverGround", 6.2),
      update("navigation.headingTrue", 1.4),
    );
    expect(v.cog).toBe(1.5);
    expect(v.sog).toBe(6.2);
    expect(v.hdg).toBe(1.4);
  });

  it("keeps a zero course rather than treating it as missing", () => {
    const v = ingest(
      update("navigation.courseOverGroundTrue", 0),
      update("navigation.speedOverGround", 0),
    );
    expect(v.cog).toBe(0);
    expect(v.sog).toBe(0);
  });

  it("reads rate of turn, magnetic variation, state and special manoeuvre", () => {
    const v = ingest(
      update("navigation.rateOfTurn", 0.01),
      update("navigation.magneticVariation", 0.05),
      update("navigation.state", "motoring"),
      update("navigation.specialManeuver", "no special maneuver"),
    );
    expect(v.rot).toBe(0.01);
    expect(v.magvar).toBe(0.05);
    expect(v.status).toBe("motoring");
    expect(v.specialManeuver).toBe("no special maneuver");
  });

  it("reads the destination", () => {
    expect(
      ingest(update("navigation.destination.commonName", "TALLINN"))
        .destination,
    ).toBe("TALLINN");
  });
});

describe("design and class paths", () => {
  it("reads the ais ship type as id and name", () => {
    const v = ingest(update("design.aisShipType", { id: 70, name: "Cargo" }));
    expect(v.typeId).toBe(70);
    expect(v.type).toBe("Cargo");
  });

  it("reads the ais class", () => {
    expect(ingest(update("sensors.ais.class", "A")).aisClass).toBe("A");
  });

  it("takes overall length, plain beam and current draft", () => {
    const v = ingest(
      update("design.length", { overall: 82 }),
      update("design.beam", 12),
      update("design.draft", { current: 4.5 }),
    );
    expect(v.length).toBe(82);
    expect(v.beam).toBe(12);
    expect(v.draft).toBe(4.5);
  });
});

describe("aids to navigation", () => {
  it("reads the aton type and defaults its status", () => {
    const v = ingest(update("atonType", { id: 5, name: "Beacon" }));
    expect(v.typeId).toBe(5);
    expect(v.type).toBe("Beacon");
    expect(v.status).toBe("default");
  });

  it("does not overwrite a status it already has", () => {
    ingest(update("navigation.state", "moored"));
    const v = ingest(update("atonType", { id: 5, name: "Beacon" }));
    expect(v.status).toBe("moored");
  });

  it("reads off position and virtual as flags", () => {
    const v = ingest(update("offPosition", true), update("virtual", true));
    expect(v.isOffPosition).toBe(1);
    expect(v.isVirtual).toBe(1);
  });

  it("reads false flags as zero, not as missing", () => {
    const v = ingest(update("offPosition", false), update("virtual", false));
    expect(v.isOffPosition).toBe(0);
    expect(v.isVirtual).toBe(0);
  });
});

describe("robustness", () => {
  it("skips null values instead of clearing the field", () => {
    ingest(update("navigation.speedOverGround", 6.2));
    const v = ingest(update("navigation.speedOverGround", null));
    expect(v.sog).toBe(6.2);
  });

  it("ignores an unrecognised path", () => {
    const v = ingest(update("some.future.path", 123));
    expect(v).toBeDefined();
  });

  it("tolerates an update with no values array", () => {
    expect(() =>
      ingest({ timestamp: "2026-08-12T10:00:00.000Z" } as unknown as Update),
    ).not.toThrow();
  });

  it("applies later values over earlier ones in the same flush", () => {
    const v = ingest(
      update("navigation.speedOverGround", 1),
      update("navigation.speedOverGround", 2),
    );
    expect(v.sog).toBe(2);
  });
});

describe("subscription message", () => {
  it("subscribes to the paths the parser understands", () => {
    const paths = (
      subscription as unknown as { subscribe: { path: string }[] }
    ).subscribe.map((s) => s.path);

    for (const path of [
      "navigation.position",
      "navigation.speedOverGround",
      "navigation.courseOverGroundTrue",
    ]) {
      expect(paths).toContain(path);
    }
  });
});

describe("connection state", () => {
  it("starts disconnected", () => {
    expect(ingestion.connectionState).toBe(DISCONNECTED);
  });

  it("is a plain reactive field the ui can read", () => {
    ingestion.connectionState = CONNECTED;
    expect(ingestion.connectionState).toBe(CONNECTED);
  });
});
