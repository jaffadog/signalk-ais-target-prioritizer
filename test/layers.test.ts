import { describe, it, expect, beforeEach } from "vitest";

import { addSharedSources } from "../src/app/sources";
import { addSharedLayers, getLabelColor } from "../src/app/layers";
import { mapState } from "../src/app/map.svelte";
import { BUILTIN_SATELLITE, BUILTIN_STREET } from "../src/app/basemaps.svelte";
import { ui } from "../src/app/ui.svelte";
import { TRAIL_OWN_WIDTH } from "../src/engine/constants";
import type { Map } from "maplibre-gl";

type LayerSpec = { id: string; type: string; source: string };

// enough of the maplibre Map surface for addSharedSources/addSharedLayers, which
// only ever ask whether something exists and then add it
function fakeMap() {
  const sources = new Map<string, unknown>();
  const layers: LayerSpec[] = [];
  return {
    getSource: (id: string) => sources.get(id),
    addSource: (id: string, spec: unknown) => sources.set(id, spec),
    getLayer: (id: string) => layers.find((l) => l.id === id),
    addLayer: (spec: LayerSpec) => layers.push(spec),
    _sources: sources,
    _layers: layers,
  };
}

let map: ReturnType<typeof fakeMap>;

function build() {
  map = fakeMap();
  mapState.instance = map as unknown as Map;
  mapState.loaded = true;
  addSharedSources();
  addSharedLayers();
}

beforeEach(() => {
  mapState.basemapId = BUILTIN_STREET;
  mapState.openSeaMap = false;
  ui.darkMode = false;
  build();
});

describe("addSharedSources", () => {
  it("adds every source the layers reference", () => {
    for (const id of [
      "vessels",
      "predictors",
      "range-rings",
      "range-labels",
      "own-trail",
      "target-trails",
      "openseamap",
    ]) {
      expect(map._sources.has(id), id).toBe(true);
    }
  });

  it("starts the geojson sources empty", () => {
    const vessels = map._sources.get("vessels") as {
      type: string;
      data: { features: unknown[] };
    };
    expect(vessels.type).toBe("geojson");
    expect(vessels.data.features).toEqual([]);
  });

  it("does not add a source twice", () => {
    const before = map._sources.size;
    addSharedSources();
    expect(map._sources.size).toBe(before);
  });

  it("does nothing before the map has loaded", () => {
    const fresh = fakeMap();
    mapState.instance = fresh as unknown as Map;
    mapState.loaded = false;

    addSharedSources();

    expect(fresh._sources.size).toBe(0);
  });

  it("does nothing without a map", () => {
    mapState.instance = null;
    expect(() => addSharedSources()).not.toThrow();
  });
});

describe("addSharedLayers", () => {
  const ids = () => map._layers.map((l) => l.id);

  it("adds every layer the plot needs", () => {
    for (const id of [
      "openseamap",
      "range-rings",
      "range-labels",
      "own-trail",
      "target-trails",
      "vessels-icons-map",
      "vessels-icons-viewport",
      "predictors",
      "predictor-markers",
      "vessels-labels",
      "vessels-lost-x",
      "vessel-selected",
    ]) {
      expect(ids(), id).toContain(id);
    }
  });

  it("only references sources that exist", () => {
    for (const layer of map._layers) {
      expect(map._sources.has(layer.source), layer.id).toBe(true);
    }
  });

  it("does not add a layer twice", () => {
    const before = map._layers.length;
    addSharedLayers();
    expect(map._layers).toHaveLength(before);
  });

  it("does nothing before the map has loaded", () => {
    const fresh = fakeMap();
    mapState.instance = fresh as unknown as Map;
    mapState.loaded = false;

    addSharedLayers();

    expect(fresh._layers).toHaveLength(0);
  });

  describe("draw order", () => {
    // maplibre draws in the order layers are added, so this is the z-order
    it("draws trails beneath the vessel icons", () => {
      const order = ids();
      const lastTrail = Math.max(
        order.indexOf("own-trail"),
        order.indexOf("target-trails"),
      );
      const firstIcon = Math.min(
        order.indexOf("vessels-icons-map"),
        order.indexOf("vessels-icons-viewport"),
      );
      expect(lastTrail).toBeLessThan(firstIcon);
    });

    it("draws the range rings beneath everything else", () => {
      const order = ids();
      expect(order.indexOf("range-rings")).toBeLessThan(
        order.indexOf("own-trail"),
      );
    });

    it("draws the selection marker above the icons", () => {
      const order = ids();
      expect(order.indexOf("vessel-selected")).toBeGreaterThan(
        order.indexOf("vessels-icons-map"),
      );
    });
  });

  describe("layer types", () => {
    it("draws both past tracks as lines - own ship solid, targets dotted", () => {
      const byId = (id: string) => map._layers.find((l) => l.id === id)!;
      expect(byId("own-trail").type).toBe("line");

      // targets are a dotted line rather than a dot per reported position: the api
      // carries no timestamps, so real "dots equally spaced by time" is not available.
      // a zero length dash with a round cap draws a round dot.
      const targets = byId("target-trails");
      expect(targets.type).toBe("line");
      expect(targets.layout?.["line-cap"]).toBe("round");
      const [dash, gap] = targets.paint?.["line-dasharray"] as number[];
      expect(dash).toBe(0);
      expect(gap).toBeGreaterThan(0);
    });

    it("keeps own ship's trail solid, so it stays distinguishable from a target's", () => {
      const byId = (id: string) => map._layers.find((l) => l.id === id)!;
      expect(byId("own-trail").paint?.["line-dasharray"]).toBeUndefined();
    });

    // IMO SN.1/Circ.243 asks for a thin line for own ship's past track when the
    // position comes from a secondary source, which a Signal K feed is
    it("draws own ship's past track thinner than its projected course", () => {
      const paint = (id: string) =>
        (
          map._layers.find((l) => l.id === id) as unknown as {
            paint: Record<string, unknown>;
          }
        ).paint;
      expect(paint("own-trail")["line-width"]).toBe(TRAIL_OWN_WIDTH);
      expect(paint("own-trail")["line-width"] as number).toBeLessThan(
        paint("predictors")["line-width"] as number,
      );
    });
  });

  it("respects the openseamap toggle when the layer is created", () => {
    mapState.openSeaMap = true;
    build();
    const layout = (
      map._layers.find((l) => l.id === "openseamap") as unknown as {
        layout: { visibility: string };
      }
    ).layout;
    expect(layout.visibility).toBe("visible");
  });
});

describe("getLabelColor", () => {
  it("is dark on a light basemap", () => {
    ui.darkMode = false;
    mapState.basemapId = BUILTIN_STREET;
    expect(getLabelColor()).toBe("black");
  });

  it("is light in dark mode", () => {
    ui.darkMode = true;
    expect(getLabelColor()).toBe("white");
  });

  // satellite imagery is dark whatever the ui theme, so labels have to be light
  it("is light over satellite even in light mode", () => {
    ui.darkMode = false;
    mapState.basemapId = BUILTIN_SATELLITE;
    expect(getLabelColor()).toBe("white");
  });
});
