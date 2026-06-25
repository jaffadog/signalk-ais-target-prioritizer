import { mapState } from "./map.svelte";

export function addSharedSources() {
  const map = mapState.instance;
  if (!map || !mapState.loaded) return;

  if (!map.getSource("vessels")) {
    map.addSource("vessels", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }

  if (!map.getSource("predictors")) {
    map.addSource("predictors", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }

  if (!map.getSource("range-rings")) {
    map.addSource("range-rings", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }

  if (!map.getSource("range-labels")) {
    map.addSource("range-labels", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }

  if (!map.getSource("openseamap")) {
    map.addSource("openseamap", {
      type: "raster",
      tiles: ["https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: '© <a href="https://www.openseamap.org">OpenSeaMap</a>',
    });
  }
}
