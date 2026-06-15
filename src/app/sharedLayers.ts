import type { LayerSpecification } from "maplibre-gl";
import { COLOR_MAP } from "../engine/constants";
import { mapState } from "../engine/map.svelte";
import { ui } from "./ui.svelte";

const DEFAULT_DARK_LABEL_COLOR = "white";
const DEFAULT_LIGHT_LABEL_COLOR = "black";

export function buildSharedLayers(): LayerSpecification[] {
  return [
    // NOTE order matters here. list from the bottom up.

    // {
    //   id: "background",
    //   type: "background",
    //   paint: {
    //     "background-color": theme.backgroundColor,
    //   },
    // },

    {
      id: "openseamap",
      type: "raster",
      source: "openseamap",
      layout: {
        visibility: mapState.openSeaMap ? "visible" : "none",
      },
      paint: {
        "raster-opacity": 0.8,
      },
    },

    {
      id: "range-rings",
      type: "line",
      source: "range-rings",
      paint: {
        "line-color": COLOR_MAP["gray"],
        "line-width": 1,
        "line-opacity": 0.7,
      },
    },

    {
      id: "range-labels",
      type: "symbol",
      source: "range-labels",
      layout: {
        "text-field": ["get", "label"],
        "text-font": ["Noto Sans Regular"],
        "text-size": 12,
        "text-anchor": "center",
        // "text-offset": [0, 0],
        // "text-offset": [0, -0.5], // nudge up by half an em, inside the top ring
        "text-offset": [
          "case",
          ["==", ["get", "direction"], "top"],
          ["literal", [0, 0.75]], // top label nudged down (inward)
          ["literal", [0, -0.75]], // bottom label nudged up (inward)
        ],
      },
      paint: {
        "text-color": getLabelColor(),
        // "text-halo-color": "white",
        // "text-halo-width": 1.5,
      },
    },

    {
      id: "vessels-icons-map",
      type: "symbol",
      source: "vessels",
      filter: ["==", ["get", "alignment"], "map"],
      layout: {
        "icon-image": ["get", "icon"],
        "icon-size": ["case", ["boolean", ["get", "isLarge"], false], 1.5, 1],
        "icon-rotate": ["coalesce", ["to-number", ["get", "rotate"]], 0],
        "icon-rotation-alignment": "map",
        "symbol-sort-key": ["get", "order"], // stack z-order by priority
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
      // paint: {
      //   "icon-opacity": 0.95,
      //   "icon-color": "#1f78ff",
      // },
    },

    {
      id: "vessels-icons-viewport",
      type: "symbol",
      source: "vessels",
      filter: ["!=", ["get", "alignment"], "map"],
      layout: {
        "icon-image": ["get", "icon"],
        "icon-size": ["case", ["boolean", ["get", "isLarge"], false], 1.5, 1],
        "icon-rotate": ["coalesce", ["to-number", ["get", "rotate"]], 0],
        "icon-rotation-alignment": "viewport",
        "symbol-sort-key": ["get", "order"],
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
      // paint: {
      //   "icon-opacity": 0.95,
      //   "icon-color": "#1f78ff",
      // },
    },

    {
      id: "predictors",
      type: "line",
      source: "predictors",
      paint: {
        "line-color": ["get", "color"],
        "line-width": 2,
        "line-opacity": 0.7,
        "line-dasharray": [
          "case",
          ["==", ["get", "color"], COLOR_MAP["blue"]],
          ["literal", [1]],
          ["literal", [3, 2]],
        ],
      },
    },

    {
      id: "predictor-markers",
      type: "circle",
      source: "predictors",
      filter: ["==", ["get", "isCircle"], true], // only circles
      paint: {
        "circle-radius": 6,
        "circle-color": COLOR_MAP["blue"],
        "circle-opacity": 0.7,
        "circle-stroke-width": 3,
        "circle-stroke-color": COLOR_MAP["blue"],
        "circle-stroke-opacity": 1,
      },
    },

    {
      id: "vessels-labels",
      type: "symbol",
      source: "vessels",
      layout: {
        "text-field": ["get", "labelText"],
        "text-font": ["Noto Sans Regular"],
        "text-size": 12,
        "text-variable-anchor": ["left", "right"],
        "text-radial-offset": 1.5,
        "text-justify": "left",
        "text-max-width": 16,
        "text-line-height": 1.1,
        "text-allow-overlap": false,
        "text-ignore-placement": false,
      },
      paint: {
        "text-color": getLabelColor(),
        // "text-color": "#f8fafc",
        // "text-halo-color": "rgba(8, 15, 28, 0.9)",
        // "text-halo-width": 1.5,
      },
    },

    {
      id: "vessels-lost-x",
      type: "symbol",
      source: "vessels",
      filter: ["==", ["get", "isLost"], true], // only lost vessels
      layout: {
        "icon-image": "vessel-lost-x",
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
    },

    {
      id: "vessel-selected",
      type: "symbol",
      source: "vessels",
      filter: ["==", ["get", "isSelected"], true], // only selected vessel
      layout: {
        "icon-image": "vessel-selected",
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
    },
  ];
}

export function getLabelColor() {
  // FIXME probably need to consider colors per basemap
  // or add halo/shadow
  // or "neutral" basemaps get some treatment
  return ui.darkMode || mapState.basemapId === "satellite"
    ? DEFAULT_DARK_LABEL_COLOR
    : DEFAULT_LIGHT_LABEL_COLOR;
}
