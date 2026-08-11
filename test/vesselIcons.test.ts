import { describe, it, expect, beforeEach } from "vitest";

import { getVesselIconName } from "../src/app/utils/vesselIcons";
import { createVessel, vesselsState } from "../src/engine/vessels.svelte";
import type { Context } from "@signalk/server-api";
import type { Vessel } from "../src/types";

const ctx = (id: string) => `vessels.urn:mrn:imo:mmsi:${id}` as Context;

function vessel(overrides: Partial<Vessel> = {}): Vessel {
  return { ...createVessel(ctx("230000001")), ...overrides };
}

beforeEach(() => {
  vesselsState.myVesselContext = null;
  vesselsState.selectedVesselContext = null;
});

describe("getVesselIconName", () => {
  describe("vessel class", () => {
    it("uses the class A hull for class A", () => {
      expect(getVesselIconName(vessel({ aisClass: "A" }))).toBe(
        "vessel-class-a-gray",
      );
    });

    it("falls back to class B for anything unrecognised", () => {
      expect(getVesselIconName(vessel({ aisClass: "B" }))).toBe(
        "vessel-class-b-gray",
      );
      expect(getVesselIconName(vessel({ aisClass: null }))).toBe(
        "vessel-class-b-gray",
      );
      expect(getVesselIconName(vessel({ aisClass: "SOMETHING" }))).toBe(
        "vessel-class-b-gray",
      );
    });

    it("uses the base station symbol for BASE", () => {
      expect(getVesselIconName(vessel({ aisClass: "BASE" }))).toBe(
        "vessel-base-gray",
      );
    });

    it("uses the aton symbol for an aid to navigation", () => {
      expect(getVesselIconName(vessel({ aisClass: "ATON" }))).toBe(
        "vessel-aton-gray",
      );
    });

    // 99MIDXXXX is the aid-to-navigation mmsi range
    it("treats a 99 prefixed mmsi as an aton even without the class", () => {
      expect(
        getVesselIconName(vessel({ mmsi: "992301234", aisClass: null })),
      ).toBe("vessel-aton-gray");
    });
  });

  describe("distress and special targets", () => {
    // 111 SAR aircraft, 970 AIS-SART, 972 MOB, 974 EPIRB
    it("uses the sart symbol for every distress prefix", () => {
      for (const prefix of ["111", "970", "972", "974"]) {
        expect(getVesselIconName(vessel({ mmsi: `${prefix}123456` }))).toBe(
          "vessel-sart",
        );
      }
    });

    it("does not colour the sart symbol - it is always red", () => {
      const v = vessel({ mmsi: "970123456", alarmState: "warning" });
      expect(getVesselIconName(v)).toBe("vessel-sart");
    });

    it("takes precedence over the vessel class", () => {
      const v = vessel({ mmsi: "970123456", aisClass: "A" });
      expect(getVesselIconName(v)).toBe("vessel-sart");
    });

    it("leaves an ordinary mmsi as a normal target", () => {
      expect(getVesselIconName(vessel({ mmsi: "230123456" }))).toBe(
        "vessel-class-b-gray",
      );
    });
  });

  describe("own vessel", () => {
    it("has its own symbol", () => {
      const mine = ctx("mine");
      vesselsState.myVesselContext = mine;
      expect(getVesselIconName(vessel({ context: mine }))).toBe(
        "vessel-my-vessel",
      );
    });

    it("wins over the distress prefixes and the class", () => {
      const mine = ctx("mine");
      vesselsState.myVesselContext = mine;
      const v = vessel({ context: mine, mmsi: "970123456", aisClass: "A" });
      expect(getVesselIconName(v)).toBe("vessel-my-vessel");
    });

    it("ignores our own alarm state", () => {
      const mine = ctx("mine");
      vesselsState.myVesselContext = mine;
      const v = vessel({ context: mine, alarmState: "danger" });
      expect(getVesselIconName(v)).toBe("vessel-my-vessel");
    });
  });

  describe("colour by state", () => {
    it("is red for danger and orange for warning", () => {
      expect(getVesselIconName(vessel({ alarmState: "danger" }))).toBe(
        "vessel-class-b-red",
      );
      expect(getVesselIconName(vessel({ alarmState: "warning" }))).toBe(
        "vessel-class-b-orange",
      );
    });

    it("is gray with no alarm", () => {
      expect(getVesselIconName(vessel({ alarmState: null }))).toBe(
        "vessel-class-b-gray",
      );
    });

    it("is blue when selected", () => {
      const context = ctx("selected");
      vesselsState.selectedVesselContext = context;
      expect(getVesselIconName(vessel({ context }))).toBe(
        "vessel-class-b-blue",
      );
    });

    it("shows selection ahead of the alarm colour", () => {
      const context = ctx("selected");
      vesselsState.selectedVesselContext = context;
      const v = vessel({ context, alarmState: "danger" });
      expect(getVesselIconName(v)).toBe("vessel-class-b-blue");
    });

    it("applies the colour to every class", () => {
      for (const [aisClass, type] of [
        ["A", "class-a"],
        ["B", "class-b"],
        ["BASE", "base"],
        ["ATON", "aton"],
      ] as const) {
        expect(
          getVesselIconName(vessel({ aisClass, alarmState: "danger" })),
        ).toBe(`vessel-${type}-red`);
      }
    });
  });

  it("only ever names icons that registerAllIcons creates", () => {
    // the layer silently draws nothing if the name is not registered, so the
    // shape of the name matters as much as the branch that picked it
    const registered = new Set([
      "vessel-my-vessel",
      "vessel-sart",
      "vessel-lost-x",
      "vessel-selected",
      ...["class-a", "class-b", "aton", "base"].flatMap((type) =>
        ["gray", "orange", "red", "blue"].map((c) => `vessel-${type}-${c}`),
      ),
    ]);

    const cases: Vessel[] = [
      vessel(),
      vessel({ aisClass: "A" }),
      vessel({ aisClass: "BASE" }),
      vessel({ aisClass: "ATON" }),
      vessel({ mmsi: "992301234" }),
      vessel({ mmsi: "970123456" }),
      vessel({ alarmState: "danger" }),
      vessel({ alarmState: "warning" }),
      vessel({ aisClass: "A", alarmState: "danger" }),
    ];

    for (const v of cases) {
      expect(registered, getVesselIconName(v)).toContain(getVesselIconName(v));
    }
  });
});
