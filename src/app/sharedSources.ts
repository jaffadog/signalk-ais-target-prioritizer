import type { SourceSpecification } from "maplibre-gl";

export const sharedSources = {
  vessels: {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  } as SourceSpecification,

  predictors: {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  } as SourceSpecification,

  "range-rings": {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  } as SourceSpecification,

  "range-labels": {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  } as SourceSpecification,

  openseamap: {
    type: "raster",
    tiles: ["https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png"],
    tileSize: 256,
    attribution: '© <a href="https://www.openseamap.org">OpenSeaMap</a>',
  } as SourceSpecification,
};
