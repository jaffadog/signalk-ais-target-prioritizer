import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

import { updateVessels } from "../src/engine/refreshLoop.svelte";
import {
  createVessel,
  vessels,
  vesselsState,
} from "../src/engine/vessels.svelte";
import { resetCollisionProfiles } from "../src/engine/collisionProfiles.svelte";
import {
  KNOTS_PER_M_PER_S,
  METERS_PER_NM,
  TARGET_MAX_AGE,
} from "../src/engine/constants";
import type { Context } from "@signalk/server-api";
import type { Vessel } from "../src/types";

const MINE = "vessels.urn:mrn:signalk:uuid:mine" as Context;
const ctx = (id: string) => `vessels.urn:mrn:imo:mmsi:${id}` as Context;

const knots = (kn: number) => kn / KNOTS_PER_M_PER_S;
const NORTH = 0;
const SOUTH = Math.PI;

// degrees of latitude for a distance in nautical miles - one minute is one NM
const nmNorth = (nm: number) => nm / 60;

function put(context: Context, overrides: Partial<Vessel> = {}) {
  vessels[context] = {
    ...createVessel(context),
    latitude: 0,
    longitude: 0,
    sog: 0,
    cog: NORTH,
    lastSeenDate: new Date(),
    ...overrides,
  };
  return vessels[context];
}

function setupOwnVessel(overrides: Partial<Vessel> = {}) {
  vesselsState.myVesselContext = MINE;
  return put(MINE, overrides);
}

beforeEach(() => {
  for (const key of Object.keys(vessels)) delete vessels[key as Context];
  vesselsState.myVesselContext = null;
  vesselsState.selectedVesselContext = null;
  resetCollisionProfiles();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe("updateVessels", () => {
  it("does nothing without our own vessel - everything is relative to it", () => {
    const target = put(ctx("1"), { latitude: nmNorth(1) });

    updateVessels();

    expect(target.range).toBeUndefined();
    expect(target.bearing).toBeUndefined();
  });

  it("derives range and bearing for a target", () => {
    setupOwnVessel();
    const target = put(ctx("1"), { latitude: nmNorth(2) });

    updateVessels();

    expect(target.range! / METERS_PER_NM).toBeCloseTo(2, 1);
    expect(target.bearing).toBeCloseTo(0, 1);
  });

  it("reads bearing clockwise from north", () => {
    setupOwnVessel();
    const east = put(ctx("1"), { longitude: nmNorth(2) });
    const south = put(ctx("2"), { latitude: -nmNorth(2) });

    updateVessels();

    expect(east.bearing).toBeCloseTo(90, 0);
    expect(south.bearing).toBeCloseTo(180, 0);
  });

  it("marks a target with a position as valid", () => {
    setupOwnVessel();
    const target = put(ctx("1"), { latitude: nmNorth(1) });
    const noPosition = put(ctx("2"), { latitude: null, longitude: null });

    updateVessels();

    expect(target.isValid).toBe(true);
    expect(noPosition.isValid).toBe(false);
  });

  it("does not give our own vessel a range or bearing to itself", () => {
    const mine = setupOwnVessel();
    put(ctx("1"), { latitude: nmNorth(1) });

    updateVessels();

    expect(mine.range).toBeUndefined();
    expect(mine.bearing).toBeUndefined();
  });

  describe("cpa", () => {
    it("computes cpa and tcpa for a closing target", () => {
      setupOwnVessel();
      // 1 NM north, steaming south at 10 kn, straight at us
      const target = put(ctx("1"), {
        latitude: nmNorth(1),
        sog: knots(10),
        cog: SOUTH,
      });

      updateVessels();

      expect(target.tcpa).toBeCloseTo(METERS_PER_NM / knots(10), 0);
      expect(target.cpa! / METERS_PER_NM).toBeLessThan(0.1);
    });

    it("leaves cpa unset for a target opening away from us", () => {
      setupOwnVessel();
      const target = put(ctx("1"), {
        latitude: nmNorth(1),
        sog: knots(10),
        cog: NORTH,
      });

      updateVessels();

      expect(target.cpa).toBeUndefined();
      expect(target.tcpa).toBeUndefined();
    });

    // the cpa calc is skipped past 100 NM to keep the per-tick cost down
    it("skips cpa for a very distant target", () => {
      setupOwnVessel();
      const target = put(ctx("1"), {
        latitude: nmNorth(150),
        sog: knots(10),
        cog: SOUTH,
      });

      updateVessels();

      expect(target.range! / METERS_PER_NM).toBeGreaterThan(100);
      expect(target.cpa).toBeUndefined();
    });

    it("raises an alarm state on a close, fast closing target", () => {
      setupOwnVessel();
      const target = put(ctx("1"), {
        latitude: nmNorth(1),
        sog: knots(10),
        cog: SOUTH,
      });

      updateVessels();

      // offshore defaults: danger inside 2 NM cpa and 15 min tcpa
      expect(target.alarmState).toBe("danger");
      expect(target.alarmType).toContain("cpa");
    });

    it("leaves a far, slow target quiet", () => {
      setupOwnVessel();
      const target = put(ctx("1"), { latitude: nmNorth(30), sog: 0 });

      updateVessels();

      expect(target.alarmState).toBeNull();
      expect(target.alarmType).toBeNull();
    });

    it("gives every target an order so the list can be sorted", () => {
      setupOwnVessel();
      const near = put(ctx("1"), { latitude: nmNorth(1) });
      const far = put(ctx("2"), { latitude: nmNorth(20) });

      updateVessels();

      expect(near.order).toBeLessThan(far.order!);
    });
  });

  describe("predicted and cpa locations", () => {
    it("projects a moving target ahead", () => {
      setupOwnVessel();
      const target = put(ctx("1"), {
        latitude: nmNorth(5),
        sog: knots(10),
        cog: NORTH,
      });

      updateVessels();

      expect(target.predictedLocation).toBeDefined();
      // heading north, so the projection is further north than the vessel
      expect(target.predictedLocation![1]).toBeGreaterThan(target.latitude!);
    });

    it("only works out a cpa location once a target is selected", () => {
      setupOwnVessel({ sog: knots(5), cog: NORTH });
      const target = put(ctx("1"), {
        latitude: nmNorth(2),
        sog: knots(10),
        cog: SOUTH,
      });

      updateVessels();
      expect(target.cpaLocation).toBeUndefined();

      vesselsState.selectedVesselContext = ctx("1");
      updateVessels();

      expect(target.cpaLocation).toBeDefined();
    });

    // our own location needs the selected target's tcpa, which is computed later
    // in the same pass, so it lands on the following tick. harmless at 1 Hz, but
    // it does mean the order vessels are iterated in matters.
    it("works out our own cpa location on the tick after selection", () => {
      const mine = setupOwnVessel({ sog: knots(5), cog: NORTH });
      put(ctx("1"), { latitude: nmNorth(2), sog: knots(10), cog: SOUTH });
      vesselsState.selectedVesselContext = ctx("1");

      updateVessels();
      expect(mine.cpaLocation).toBeUndefined();

      updateVessels();
      expect(mine.cpaLocation).toBeDefined();
    });

    it("leaves unselected targets without a cpa location", () => {
      setupOwnVessel({ sog: knots(5), cog: NORTH });
      put(ctx("1"), { latitude: nmNorth(2), sog: knots(10), cog: SOUTH });
      const other = put(ctx("2"), {
        latitude: nmNorth(3),
        sog: knots(10),
        cog: SOUTH,
      });
      vesselsState.selectedVesselContext = ctx("1");

      updateVessels();

      expect(other.cpaLocation).toBeUndefined();
    });
  });

  describe("ageing out", () => {
    it("keeps a recently seen target", () => {
      setupOwnVessel();
      put(ctx("1"), {
        latitude: nmNorth(1),
        lastSeenDate: new Date(Date.now() - 60_000),
      });

      updateVessels();

      expect(vessels[ctx("1")]).toBeDefined();
    });

    it("deletes a target past the maximum age", () => {
      setupOwnVessel();
      put(ctx("1"), {
        latitude: nmNorth(1),
        lastSeenDate: new Date(Date.now() - (TARGET_MAX_AGE + 60) * 1000),
      });

      updateVessels();

      expect(vessels[ctx("1")]).toBeUndefined();
    });

    it("marks a quiet but not yet expired target as lost", () => {
      setupOwnVessel();
      const target = put(ctx("1"), {
        latitude: nmNorth(1),
        lastSeenDate: new Date(Date.now() - 20 * 60 * 1000),
      });

      updateVessels();

      expect(target.isLost).toBe(true);
    });

    it("never ages out our own vessel, however stale its position", () => {
      setupOwnVessel({
        lastSeenDate: new Date(Date.now() - (TARGET_MAX_AGE + 3600) * 1000),
      });

      updateVessels();

      expect(vessels[MINE]).toBeDefined();
    });

    it("keeps going after deleting one target mid pass", () => {
      setupOwnVessel();
      put(ctx("stale"), {
        latitude: nmNorth(1),
        lastSeenDate: new Date(Date.now() - (TARGET_MAX_AGE + 60) * 1000),
      });
      const fresh = put(ctx("fresh"), { latitude: nmNorth(2) });

      updateVessels();

      expect(vessels[ctx("stale")]).toBeUndefined();
      expect(fresh.range).toBeDefined();
    });
  });

  it("can run repeatedly without drifting", () => {
    setupOwnVessel();
    const target = put(ctx("1"), { latitude: nmNorth(2) });

    updateVessels();
    const first = target.range;
    updateVessels();
    updateVessels();

    expect(target.range).toBeCloseTo(first!, 6);
  });
});
