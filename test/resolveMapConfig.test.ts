import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

import { buildStyle } from "../src/app/resolveMapConfig";
import {
  BUILTIN_EMPTY,
  BUILTIN_OFFLINE,
  BUILTIN_SATELLITE,
  BUILTIN_STREET,
  basemaps,
} from "../src/app/basemaps.svelte";
import { mapState } from "../src/app/map.svelte";
import { ui } from "../src/app/ui.svelte";
import type { Chart } from "../src/types";

// buildStyle returns either a style url string or a maplibre style object
const isStyleObject = (s: unknown): s is { version: number; sources: object } =>
  typeof s === "object" && s !== null;

const CUSTOM = "custom:chart";

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  mapState.basemapId = BUILTIN_STREET;
  mapState.protomapsFontsAvailable = false;
  ui.darkMode = false;
  delete basemaps[CUSTOM];
});

afterEach(() => {
  delete basemaps[CUSTOM];
  vi.restoreAllMocks();
});

describe("built in basemaps", () => {
  it("gives the street map a different style per theme", () => {
    mapState.basemapId = BUILTIN_STREET;

    ui.darkMode = false;
    const light = buildStyle();
    ui.darkMode = true;
    const dark = buildStyle();

    expect(light).not.toEqual(dark);
  });

  it("builds a raster style for satellite", () => {
    mapState.basemapId = BUILTIN_SATELLITE;
    const style = buildStyle();

    expect(isStyleObject(style)).toBe(true);
    const sources = Object.values(
      (style as { sources: Record<string, { type: string }> }).sources,
    );
    expect(sources.some((s) => s.type === "raster")).toBe(true);
  });

  it("builds a vector style from the bundled pmtiles for offline", () => {
    mapState.basemapId = BUILTIN_OFFLINE;
    const style = buildStyle();

    expect(isStyleObject(style)).toBe(true);
    // served through the pmtiles protocol maplibre registers at startup
    expect(JSON.stringify(style)).toContain("pmtiles://");
  });

  it("builds an empty style for empty", () => {
    mapState.basemapId = BUILTIN_EMPTY;
    const style = buildStyle();

    expect(isStyleObject(style)).toBe(true);
    expect((style as { layers: unknown[] }).layers).toBeDefined();
  });

  it("always produces a style with a version, whatever the basemap", () => {
    for (const id of [BUILTIN_SATELLITE, BUILTIN_OFFLINE, BUILTIN_EMPTY]) {
      mapState.basemapId = id;
      const style = buildStyle();
      expect((style as { version: number }).version, id).toBe(8);
    }
  });
});

describe("charts from the signal k server", () => {
  it("builds a vector style for a pmtiles chart", () => {
    basemaps[CUSTOM] = {
      identifier: CUSTOM,
      name: "Finland",
      type: "tilelayer",
      format: "mvt",
      url: "/signalk/pmtiles/finland.pmtiles",
    } as Chart;
    mapState.basemapId = CUSTOM;

    const style = buildStyle();

    expect(JSON.stringify(style)).toContain("pmtiles://");
    expect(JSON.stringify(style)).toContain("finland.pmtiles");
  });

  it("builds a raster style for a png tilelayer", () => {
    basemaps[CUSTOM] = {
      identifier: CUSTOM,
      name: "Raster",
      type: "tilelayer",
      format: "png",
      url: "https://example.test/{z}/{x}/{y}.png",
    } as Chart;
    mapState.basemapId = CUSTOM;

    const style = buildStyle();
    const sources = Object.values(
      (style as { sources: Record<string, { type: string }> }).sources,
    );
    expect(sources.some((s) => s.type === "raster")).toBe(true);
  });

  it("passes a mapstyleJSON url straight through for maplibre to fetch", () => {
    basemaps[CUSTOM] = {
      identifier: CUSTOM,
      name: "Styled",
      type: "mapstyleJSON",
      url: "https://example.test/style.json",
    } as Chart;
    mapState.basemapId = CUSTOM;

    expect(buildStyle()).toBe("https://example.test/style.json");
  });

  it("prefers an inline style over the url when a chart has both", () => {
    basemaps[CUSTOM] = {
      identifier: CUSTOM,
      name: "Styled",
      type: "mapstyleJSON",
      style: "https://example.test/inline.json",
      url: "https://example.test/style.json",
    } as unknown as Chart;
    mapState.basemapId = CUSTOM;

    expect(buildStyle()).toBe("https://example.test/inline.json");
  });
});

describe("falling back", () => {
  it("falls back to the empty style for an unknown basemap id", () => {
    mapState.basemapId = "nothing:here";

    const style = buildStyle();

    expect(isStyleObject(style)).toBe(true);
    // and it corrects the stored id, so the next render is consistent
    expect(mapState.basemapId).toBe(BUILTIN_EMPTY);
  });

  it("falls back for a chart with no url or style to work from", () => {
    basemaps[CUSTOM] = {
      identifier: CUSTOM,
      name: "Broken",
      type: "tilelayer",
    } as Chart;
    mapState.basemapId = CUSTOM;

    buildStyle();

    expect(mapState.basemapId).toBe(BUILTIN_EMPTY);
  });

  it("never throws for any chart shape it might be handed", () => {
    const shapes: unknown[] = [
      { identifier: CUSTOM, name: "a" },
      { identifier: CUSTOM, name: "b", type: "unknown-type", url: "x" },
      { identifier: CUSTOM, name: "c", type: "mapstyleJSON" },
      { identifier: CUSTOM, name: "d", type: "tilelayer", url: "" },
    ];

    for (const shape of shapes) {
      basemaps[CUSTOM] = shape as Chart;
      mapState.basemapId = CUSTOM;
      expect(() => buildStyle()).not.toThrow();
    }
  });
});
