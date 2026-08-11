import { describe, it, expect, afterEach } from "vitest";

import {
  formatAngle,
  formatCpa,
  formatDistance,
  formatDraft,
  formatLat,
  formatLon,
  formatName,
  formatRateOfTurn,
  formatSize,
  formatSpeed,
  formatTcpa,
  formatVesselLabel,
} from "../src/app/utils/formatUtils";
import { KNOTS_PER_M_PER_S, METERS_PER_NM } from "../src/engine/constants";
import { vesselsState } from "../src/engine/vessels.svelte";
import type { Context } from "@signalk/server-api";
import type { Vessel } from "../src/types";

function vessel(overrides: Partial<Vessel> = {}): Vessel {
  return {
    context: "vessels.urn:mrn:imo:mmsi:230000001" as Context,
    name: null,
    mmsi: null,
    sog: null,
    cpa: undefined,
    tcpa: undefined,
    ...overrides,
  } as Vessel;
}

const knots = (kn: number) => kn / KNOTS_PER_M_PER_S;

afterEach(() => {
  vesselsState.myVesselContext = null;
});

describe("formatLat", () => {
  it("formats degrees and decimal minutes with a hemisphere", () => {
    expect(formatLat(39.951148)).toBe("N 39° 57.0689");
  });

  it("uses S below the equator", () => {
    expect(formatLat(-39.951148)).toBe("S 39° 57.0689");
  });

  it("pads the degrees to two digits", () => {
    expect(formatLat(5.5)).toBe("N 05° 30.0000");
  });

  it("is undefined for unusable input", () => {
    expect(formatLat(NaN)).toBeUndefined();
    expect(formatLat(null as unknown as number)).toBeUndefined();
  });
});

describe("formatLon", () => {
  it("formats degrees and decimal minutes with a hemisphere", () => {
    expect(formatLon(-75.139487)).toBe("W 075° 08.3692");
  });

  it("uses E east of Greenwich", () => {
    expect(formatLon(75.139487)).toBe("E 075° 08.3692");
  });

  it("pads the degrees to three digits", () => {
    expect(formatLon(5.5)).toBe("E 005° 30.0000");
  });

  it("is undefined for unusable input", () => {
    expect(formatLon(NaN)).toBeUndefined();
  });
});

describe("formatDistance", () => {
  it("converts metres to nautical miles", () => {
    expect(formatDistance(METERS_PER_NM)).toBe("1.00 NM");
    expect(formatDistance(1.53 * METERS_PER_NM)).toBe("1.53 NM");
    expect(formatDistance(0)).toBe("0.00 NM");
  });

  it("is undefined for unusable input", () => {
    expect(formatDistance(undefined)).toBeUndefined();
    expect(formatDistance(NaN)).toBeUndefined();
  });
});

describe("formatAngle", () => {
  it("rounds to whole degrees true", () => {
    expect(formatAngle(127.6)).toBe("128 T");
    expect(formatAngle(0)).toBe("0 T");
  });

  it("is undefined for unusable input", () => {
    expect(formatAngle(undefined)).toBeUndefined();
  });
});

describe("formatSpeed", () => {
  it("converts metres per second to knots", () => {
    expect(formatSpeed(knots(6.2))).toBe("6.2 kn");
    expect(formatSpeed(0)).toBe("0.0 kn");
  });

  it("is undefined for unusable input", () => {
    expect(formatSpeed(null)).toBeUndefined();
  });
});

describe("formatSize", () => {
  it("formats length by beam", () => {
    expect(formatSize(82, 12)).toBe("82.0 m x 12.0 m");
  });

  it("dashes out whichever dimension is missing, rather than returning undefined", () => {
    expect(formatSize(null, 12)).toBe("--- m x 12.0 m");
    expect(formatSize(82, null)).toBe("82.0 m x --- m");
    expect(formatSize(null, null)).toBe("--- m x --- m");
  });
});

describe("formatDraft", () => {
  it("formats one decimal of metres", () => {
    expect(formatDraft(10.14)).toBe("10.1 m");
  });

  it("is undefined for unusable input", () => {
    expect(formatDraft(NaN)).toBeUndefined();
  });
});

describe("formatRateOfTurn", () => {
  it("converts radians per second to degrees per second", () => {
    expect(formatRateOfTurn(Math.PI / 180)).toBe("1.000 deg/s");
  });

  it("keeps the sign so the turn direction survives", () => {
    expect(formatRateOfTurn(-Math.PI / 180)).toBe("-1.000 deg/s");
  });

  it("is undefined for unusable input", () => {
    expect(formatRateOfTurn(NaN)).toBeUndefined();
  });
});

describe("formatCpa", () => {
  it("formats the distance when the cpa is ahead", () => {
    expect(formatCpa(METERS_PER_NM, 600)).toBe("1.00 NM");
  });

  it("is undefined once the cpa is behind us", () => {
    expect(formatCpa(METERS_PER_NM, -1)).toBeUndefined();
  });

  it("is undefined without a tcpa", () => {
    expect(formatCpa(METERS_PER_NM, undefined)).toBeUndefined();
  });
});

describe("formatTcpa", () => {
  it("uses mm:ss under an hour", () => {
    expect(formatTcpa(0)).toBe("00:00");
    expect(formatTcpa(75)).toBe("01:15");
    expect(formatTcpa(3599)).toBe("59:59");
  });

  it("switches to hh:mm:ss at an hour", () => {
    expect(formatTcpa(3600)).toBe("01:00:00");
    expect(formatTcpa(4523)).toBe("01:15:23");
  });

  it("is undefined for a negative or missing tcpa", () => {
    expect(formatTcpa(-1)).toBeUndefined();
    expect(formatTcpa(undefined)).toBeUndefined();
  });
});

describe("formatName", () => {
  it("prefers the vessel name", () => {
    expect(formatName(vessel({ name: "ADRIATIC HIGHWAY" }))).toBe(
      "ADRIATIC HIGHWAY",
    );
  });

  it("strips the @ padding signal k leaves on some AIS names", () => {
    expect(formatName(vessel({ name: "FINNFUN@@@@" }))).toBe("FINNFUN");
  });

  it("labels our own vessel", () => {
    const context = "vessels.urn:mrn:signalk:uuid:abc" as Context;
    vesselsState.myVesselContext = context;
    expect(formatName(vessel({ context }))).toBe("MY VESSEL");
  });

  it("falls back to the mmsi in angle brackets", () => {
    expect(formatName(vessel({ mmsi: "230941380" }))).toBe("<230941380>");
  });

  it("falls back to UNKNOWN with neither name nor mmsi", () => {
    expect(formatName(vessel())).toBe("UNKNOWN");
  });

  it("prefers a name over our own vessel label", () => {
    const context = "vessels.urn:mrn:signalk:uuid:abc" as Context;
    vesselsState.myVesselContext = context;
    expect(formatName(vessel({ context, name: "KillCoreUI" }))).toBe(
      "KillCoreUI",
    );
  });
});

describe("formatVesselLabel", () => {
  // the trailing non breaking space keeps maplibre from trimming the last line
  const NBSP = " ";

  it("is just the name for a stationary target", () => {
    expect(formatVesselLabel(vessel({ name: "BUOY-157" }))).toBe(
      `BUOY-157\n${NBSP}`,
    );
  });

  it("adds the speed once above 0.1 kn", () => {
    expect(formatVesselLabel(vessel({ name: "CELINA", sog: knots(6.4) }))).toBe(
      `CELINA\n6.4 kn ${NBSP}`,
    );
  });

  it("omits a speed at or below 0.1 m/s", () => {
    expect(formatVesselLabel(vessel({ name: "MOORED", sog: 0.05 }))).toBe(
      `MOORED\n${NBSP}`,
    );
  });

  it("adds cpa and tcpa when a cpa is due within the hour", () => {
    const v = vessel({
      name: "KAROLIN",
      sog: knots(29),
      cpa: 1.11 * METERS_PER_NM,
      tcpa: 845,
    });
    expect(formatVesselLabel(v)).toBe(`KAROLIN\n29.0 kn 1.11 NM 14:05${NBSP}`);
  });

  it("omits cpa beyond an hour out, to keep the plot readable", () => {
    const v = vessel({
      name: "FAR",
      sog: knots(10),
      cpa: METERS_PER_NM,
      tcpa: 4000,
    });
    expect(formatVesselLabel(v)).toBe(`FAR\n10.0 kn ${NBSP}`);
  });

  it("omits cpa once it is behind us", () => {
    const v = vessel({
      name: "PAST",
      sog: knots(10),
      cpa: METERS_PER_NM,
      tcpa: -60,
    });
    expect(formatVesselLabel(v)).toBe(`PAST\n10.0 kn ${NBSP}`);
  });
});
