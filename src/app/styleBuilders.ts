import type { Theme } from "./basemap.types";
import ne10Url from "../app/assets/ne_10m_land.pmtiles?url";
import { layers, namedFlavor, type Flavor } from "@protomaps/basemaps";
import { name as pluginName } from "../../package.json";
import { mapState } from "./map.svelte";

const DEFAULT_DARK_BACKGROUND_COLOR = "#2E353B";
const DEFAULT_LIGHT_BACKGROUND_COLOR = "#D5DADC";

const DEFAULT_DARK_LAND_COLOR = "#0E0E0E";
const DEFAULT_LIGHT_LAND_COLOR = "#FAFAF8";

export function buildOfflineStyle(theme: Theme) {
  return buildNaturalEarthStyle({
    url: `pmtiles://${window.location.origin}${ne10Url}`,
    theme: theme,
  });
}
// FIXME might need to set white label colors - certainly for esri sat
export function buildRasterStyle(url: string) {
  return {
    version: 8 as const,
    sources: {
      raster: {
        type: "raster" as const,
        tiles: [url],
        tileSize: 256,
      },
    },
    layers: [
      {
        id: "raster",
        type: "raster" as const,
        source: "raster",
      },
    ],
  };
}

export function buildPmtilesStyle(url: string, theme: Theme = "light") {
  const flavor: Flavor = namedFlavor(theme);
  return {
    version: 8 as const,
    ...(mapState.protomapsFontsAvailable
      ? {
          glyphs: `${window.location.origin}/${pluginName}/assets/protomaps/fonts/{fontstack}/{range}.pbf`,
          sprite: `${window.location.origin}/${pluginName}/assets/protomaps/sprites/v4/${theme}`,
        }
      : {}),
    sources: {
      protomaps: {
        type: "vector" as const,
        url: `pmtiles://${url}`,
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
      },
    },
    layers: [
      ...layers("protomaps", flavor, { lang: "en" }).filter(
        (layer) => mapState.protomapsFontsAvailable || layer.type !== "symbol",
      ),
    ],
  };
}

export function buildNaturalEarthStyle({
  url,
  theme,
}: {
  url: string;
  theme: Theme;
}) {
  return {
    version: 8 as const,
    sources: {
      ne: {
        type: "vector" as const,
        url: url,
      },
    },
    layers: [
      {
        id: "background",
        type: "background" as const,
        paint: {
          "background-color":
            theme === "dark"
              ? DEFAULT_DARK_BACKGROUND_COLOR
              : DEFAULT_LIGHT_BACKGROUND_COLOR,
        },
      },
      {
        id: "land",
        type: "fill" as const,
        source: "ne",
        "source-layer": "earth",
        paint: {
          "fill-color":
            theme === "dark"
              ? DEFAULT_DARK_LAND_COLOR
              : DEFAULT_LIGHT_LAND_COLOR,
        },
      },
    ],
  };
}

export function buildEmptyStyle(theme: Theme) {
  return {
    version: 8 as const,
    sources: {},
    layers: [
      {
        id: "background",
        type: "background" as const,
        paint: {
          "background-color":
            theme === "dark"
              ? DEFAULT_DARK_BACKGROUND_COLOR
              : DEFAULT_LIGHT_BACKGROUND_COLOR,
        },
      },
    ],
  };
}
