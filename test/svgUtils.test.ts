import { describe, it, expect } from "vitest";

import { getVesselSvg } from "../src/app/utils/svgUtils";

// the vessel table shows a silhouette per target, chosen from the AIS ship type
// with a couple of mmsi ranges taking precedence
const svg = (
  mmsi: string | null = null,
  aisClass: string | null = null,
  typeId: number | null = null,
) => getVesselSvg(mmsi, aisClass, typeId);

describe("getVesselSvg", () => {
  it("always returns a self contained svg", () => {
    for (const icon of [
      svg(null, null, 30),
      svg(null, null, 36),
      svg(null, null, 37),
      svg(null, null, 51),
      svg(null, null, 52),
      svg(null, "A"),
      svg(null, "ATON"),
      svg(),
    ]) {
      expect(icon).toMatch(/^<svg[\s>]/);
      expect(icon.trimEnd()).toMatch(/<\/svg>$/);
    }
  });

  it("uses currentcolor so the icon follows the row's text colour", () => {
    expect(svg(null, "A")).toContain("currentcolor");
  });

  describe("by ais ship type", () => {
    it("distinguishes fishing, sailing, pleasure and tug", () => {
      const icons = [30, 36, 37, 52].map((id) => svg(null, null, id));
      // four distinct silhouettes
      expect(new Set(icons).size).toBe(4);
    });

    it("uses the search and rescue icon for type 51", () => {
      expect(svg(null, null, 51)).toBe(svg("970123456", null, null));
    });

    it("prefers the ship type over the ais class", () => {
      // a class A fishing boat is drawn as a fishing boat, not a generic ship
      expect(svg(null, "A", 30)).toBe(svg(null, null, 30));
      expect(svg(null, "A", 30)).not.toBe(svg(null, "A"));
    });
  });

  describe("by mmsi range", () => {
    // 111 SAR aircraft, 970 AIS-SART, 972 MOB, 974 EPIRB
    it("uses the sar icon for every distress prefix", () => {
      const sar = svg(null, null, 51);
      for (const prefix of ["111", "970", "972", "974"]) {
        expect(svg(`${prefix}123456`)).toBe(sar);
      }
    });

    it("uses the aton icon for the 99 range", () => {
      expect(svg("992301234")).toBe(svg(null, "ATON"));
    });

    it("puts a distress prefix ahead of the ais class", () => {
      expect(svg("970123456", "A")).toBe(svg(null, null, 51));
    });

    it("leaves an ordinary mmsi to the class and type rules", () => {
      expect(svg("230123456", "A")).toBe(svg(null, "A"));
    });
  });

  describe("fallbacks", () => {
    it("uses a generic ship for class A with no type", () => {
      expect(svg(null, "A")).not.toBe(svg());
    });

    it("falls back to the unknown icon with nothing to go on", () => {
      expect(svg()).toBe(svg("230123456", "B", 99));
    });

    it("treats an unrecognised type id as unknown", () => {
      expect(svg(null, null, 12345)).toBe(svg());
    });

    it("never returns empty", () => {
      for (const icon of [svg(), svg("", "", null), svg(null, "B", 0)]) {
        expect(icon.length).toBeGreaterThan(0);
      }
    });
  });
});
