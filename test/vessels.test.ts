import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

import {
  createVessel,
  deleteAllVessels,
  deleteVessel,
  vessels,
  vesselsState,
} from "../src/engine/vessels.svelte";
import type { Context } from "@signalk/server-api";

const ctx = (mmsi: string) => `vessels.urn:mrn:imo:mmsi:${mmsi}` as Context;

beforeEach(() => {
  for (const key of Object.keys(vessels)) delete vessels[key as Context];
  vesselsState.myVesselContext = null;
  vesselsState.selectedVesselContext = null;
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe("createVessel", () => {
  it("carries the context through", () => {
    expect(createVessel(ctx("230000001")).context).toBe(ctx("230000001"));
  });

  it("starts every signal k field null rather than undefined, so absent and unset are the same thing", () => {
    const v = createVessel(ctx("230000001"));
    for (const field of [
      "mmsi",
      "name",
      "callsign",
      "imo",
      "sog",
      "cog",
      "hdg",
      "latitude",
      "longitude",
      "lastSeenDate",
      "aisClass",
    ] as const) {
      expect(v[field], field).toBeNull();
    }
  });

  it("starts unmuted, not lost and not yet valid", () => {
    const v = createVessel(ctx("230000001"));
    expect(v.alarmIsMuted).toBe(false);
    expect(v.isLost).toBe(false);
    // no position yet, so it must not be drawn
    expect(v.isValid).toBe(false);
  });

  it("does not register itself - the caller owns insertion", () => {
    createVessel(ctx("230000001"));
    expect(Object.keys(vessels)).toHaveLength(0);
  });

  it("returns an independent object each time", () => {
    const a = createVessel(ctx("230000001"));
    const b = createVessel(ctx("230000002"));
    a.name = "MUTATED";
    expect(b.name).toBeNull();
  });
});

describe("deleteVessel", () => {
  it("removes only the given vessel", () => {
    vessels[ctx("1")] = createVessel(ctx("1"));
    vessels[ctx("2")] = createVessel(ctx("2"));

    deleteVessel(vessels[ctx("1")]);

    expect(vessels[ctx("1")]).toBeUndefined();
    expect(vessels[ctx("2")]).toBeDefined();
  });

  it("is harmless for a vessel that was never registered", () => {
    expect(() => deleteVessel(createVessel(ctx("999")))).not.toThrow();
  });
});

describe("deleteAllVessels", () => {
  it("empties the store", () => {
    for (const mmsi of ["1", "2", "3"]) {
      vessels[ctx(mmsi)] = createVessel(ctx(mmsi));
    }

    deleteAllVessels();

    expect(Object.keys(vessels)).toHaveLength(0);
  });

  // it iterates a snapshot from Object.values, so deleting as it goes is safe
  it("does not skip entries while mutating during iteration", () => {
    for (let i = 0; i < 50; i++) {
      vessels[ctx(String(i))] = createVessel(ctx(String(i)));
    }

    deleteAllVessels();

    expect(Object.keys(vessels)).toHaveLength(0);
  });

  it("is harmless on an empty store", () => {
    expect(() => deleteAllVessels()).not.toThrow();
  });
});
