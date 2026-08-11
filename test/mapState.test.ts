import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import type { Map } from "maplibre-gl";
import type { Chart } from "../src/types";

const getCharts = vi.fn();

vi.mock("../src/app/utils/api", () => ({
  getCharts: (...a: unknown[]) => getCharts(...a),
  getPmtiles: vi.fn(),
}));

const { getStyleId, mapState, setStyle } =
  await import("../src/app/map.svelte");
const { BUILTIN_EMPTY, BUILTIN_STREET, basemaps, initBasemaps } =
  await import("../src/app/basemaps.svelte");
const { ui } = await import("../src/app/ui.svelte");

// setStyle asks the map to swap styles and registers a one-shot style.load handler
function fakeMap() {
  const onceHandlers: Record<string, (() => void)[]> = {};
  return {
    isStyleLoaded: () => true,
    setStyle: vi.fn(),
    once: (event: string, fn: () => void) => {
      (onceHandlers[event] ??= []).push(fn);
    },
    getSource: () => undefined,
    addSource: vi.fn(),
    getLayer: () => undefined,
    addLayer: vi.fn(),
    _fire: (event: string) => onceHandlers[event]?.forEach((fn) => fn()),
    _onceHandlers: onceHandlers,
  };
}

let map: ReturnType<typeof fakeMap>;
const builtins = Object.keys(basemaps);

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  getCharts.mockReset();

  for (const key of Object.keys(basemaps)) {
    if (!builtins.includes(key)) delete basemaps[key];
  }

  map = fakeMap();
  mapState.instance = map as unknown as Map;
  mapState.loaded = true;
  mapState.basemapId = BUILTIN_STREET;
  mapState.styleId = null;
  ui.darkMode = false;
});

afterEach(() => vi.restoreAllMocks());

describe("getStyleId", () => {
  it("combines the basemap and the theme, since both change the style", () => {
    mapState.basemapId = BUILTIN_STREET;
    ui.darkMode = false;
    const light = getStyleId();

    ui.darkMode = true;
    expect(getStyleId()).not.toBe(light);
  });

  it("differs between basemaps", () => {
    mapState.basemapId = BUILTIN_STREET;
    const street = getStyleId();
    mapState.basemapId = BUILTIN_EMPTY;
    expect(getStyleId()).not.toBe(street);
  });

  it("is stable for the same basemap and theme", () => {
    expect(getStyleId()).toBe(getStyleId());
  });
});

describe("setStyle", () => {
  it("applies a style and records which one is loaded", () => {
    setStyle();

    expect(map.setStyle).toHaveBeenCalledTimes(1);
    expect(mapState.styleId).toBe(getStyleId());
  });

  // reloading a style tears down and rebuilds every source and layer, so the
  // guard is what stops the plot flickering on unrelated state changes
  it("does not reapply the style that is already loaded", () => {
    setStyle();
    expect(map.setStyle).toHaveBeenCalledTimes(1);

    setStyle();
    expect(map.setStyle).toHaveBeenCalledTimes(1);
  });

  it("reapplies when forced, which is how the font pack takes effect", () => {
    setStyle();
    setStyle({ force: true });

    expect(map.setStyle).toHaveBeenCalledTimes(2);
  });

  it("applies again when the basemap changes", () => {
    setStyle();
    mapState.basemapId = BUILTIN_EMPTY;
    setStyle();

    expect(map.setStyle).toHaveBeenCalledTimes(2);
  });

  it("applies again when the theme changes", () => {
    setStyle();
    ui.darkMode = true;
    setStyle();

    expect(map.setStyle).toHaveBeenCalledTimes(2);
  });

  it("does nothing without a map", () => {
    mapState.instance = null;
    expect(() => setStyle()).not.toThrow();
  });

  it("does nothing before the map has loaded", () => {
    mapState.loaded = false;
    setStyle();
    expect(map.setStyle).not.toHaveBeenCalled();
  });

  // swapping a style drops the custom sources and layers, so they are re-added
  // once the new style reports in
  it("re-adds our sources and layers after the new style loads", () => {
    setStyle();

    expect(map._onceHandlers["style.load"]).toHaveLength(1);
    expect(map.addSource).not.toHaveBeenCalled();

    map._fire("style.load");

    expect(map.addSource).toHaveBeenCalled();
    expect(map.addLayer).toHaveBeenCalled();
  });
});

describe("initBasemaps", () => {
  it("keeps the built in basemaps when the server has no charts", async () => {
    getCharts.mockResolvedValue({});

    await initBasemaps();

    for (const id of builtins) expect(basemaps[id], id).toBeDefined();
  });

  it("adds the charts the server advertises", async () => {
    getCharts.mockResolvedValue({
      "finland-estonia": {
        name: "Finland / Estonia",
        format: "mvt",
        type: "tilelayer",
        url: "/signalk/pmtiles/finland-estonia.pmtiles",
      } as Chart,
    });

    await initBasemaps();

    const chart = basemaps["finland-estonia"];
    expect(chart).toBeDefined();
    expect(chart.name).toBe("Finland / Estonia");
    expect(chart.url).toBe("/signalk/pmtiles/finland-estonia.pmtiles");
    // the key becomes the identifier, which is what the basemap picker selects by
    expect(chart.identifier).toBe("finland-estonia");
  });

  it("does not drop the built ins when charts are added", async () => {
    getCharts.mockResolvedValue({
      extra: { name: "Extra", type: "tilelayer", url: "x" } as Chart,
    });

    await initBasemaps();

    expect(basemaps[BUILTIN_STREET]).toBeDefined();
    expect(basemaps["extra"]).toBeDefined();
  });

  it("rethrows when the charts cannot be read, so init reports the failure", async () => {
    getCharts.mockRejectedValue(new Error("502"));

    await expect(initBasemaps()).rejects.toThrow("502");
  });
});
