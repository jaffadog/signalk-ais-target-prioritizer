import type { Theme } from "./basemap.types";
import ne10Url from "../app/assets/ne_10m_land.pmtiles?url";
import { sharedSources } from "./sharedSources";
import { buildSharedLayers } from "./sharedLayers";
import type { StyleSpecification } from "maplibre-gl";
import { layers, namedFlavor, type Flavor } from "@protomaps/basemaps";
import darkMatter from "./styles/dark-matter.json";
import positron from "./styles/positron.json";
import { name as pluginName } from "../../package.json";

const DEFAULT_DARK_BACKGROUND_COLOR = "#2E353B";
const DEFAULT_LIGHT_BACKGROUND_COLOR = "#D5DADC";

const DEFAULT_DARK_LAND_COLOR = "#0E0E0E";
const DEFAULT_LIGHT_LAND_COLOR = "#FAFAF8";

export function buildCartoDarkStyle() {
  return buildVectorStyle(darkMatter as unknown as StyleSpecification);
}

export function buildCartoPositronStyle() {
  return buildVectorStyle(positron as unknown as StyleSpecification);
}

function buildVectorStyle(style: StyleSpecification) {
  return {
    ...style,
    sources: {
      ...style.sources,
      ...sharedSources,
    },
    layers: [...style.layers, ...buildSharedLayers()],
  };
}

export function buildEsriSatelliteStyle() {
  return buildRasterStyle(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  );
}

export function buildOfflineStyle(theme: Theme) {
  return buildNaturalEarthStyle({
    url: `pmtiles://${window.location.origin}${ne10Url}`,
    theme: theme,
  });
}

export function buildRasterStyle(url: string) {
  return {
    version: 8 as const,
    sources: {
      raster: {
        type: "raster" as const,
        tiles: [url],
        tileSize: 256,
      },
      ...sharedSources,
    },
    layers: [
      {
        id: "raster",
        type: "raster" as const,
        source: "raster",
      },
      ...buildSharedLayers(),
    ],
  };
}

export function buildPmtilesStyle(url: string, theme: Theme = "light") {
  const flavor: Flavor = namedFlavor(theme);
  return {
    version: 8 as const,
    glyphs: `${window.location.origin}/${pluginName}/assets/protomaps/fonts/{fontstack}/{range}.pbf`,
    sprite: `${window.location.origin}/${pluginName}/assets/protomaps/sprites/v4/${theme}`,
    sources: {
      protomaps: {
        type: "vector" as const,
        url: `pmtiles://${url}`,
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
      },
      ...sharedSources,
    },
    layers: [
      // FIXME testing filtering the labels out - so that we dont need to bundle 28MB of fonts 😭
      ...layers("protomaps", flavor, { lang: "en" }).filter(
        (layer) => layer.type !== "symbol",
      ),
      ...buildSharedLayers(),
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
      ...sharedSources,
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
      ...buildSharedLayers(),
    ],
  };
}

export function buildEmptyStyle(theme: Theme) {
  return {
    version: 8 as const,
    sources: sharedSources,
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
      ...buildSharedLayers(),
    ],
  };
}
