import type { StyleSpecification } from "maplibre-gl";
import {
  buildEmptyStyle,
  buildNaturalEarthStyle,
  buildPmtilesStyle,
  buildRasterStyle,
} from "./styleBuilders";
import {
  basemaps,
  BUILTIN_EMPTY,
  BUILTIN_OFFLINE,
  BUILTIN_SATELLITE,
  BUILTIN_STREET,
} from "./basemaps.svelte";
import { mapState } from "./map.svelte";
import { ui } from "./ui.svelte";
import ne10Url from "../app/assets/ne_10m_land.pmtiles?url";
import type { Chart } from "../types";

export function buildStyle(): StyleSpecification | string {
  console.log("enter resolveMapConfig", mapState.basemapId, ui.darkMode);
  const basemap = basemaps[mapState.basemapId] as Chart | undefined;

  // builtin:street
  if (
    mapState.basemapId === BUILTIN_STREET &&
    basemap &&
    basemap.styleLight &&
    basemap.styleDark
  ) {
    return ui.darkMode ? basemap.styleDark : basemap.styleLight;
  }

  // builtin:satellite
  if (mapState.basemapId === BUILTIN_SATELLITE && basemap && basemap.url) {
    return buildRasterStyle(basemap.url);
  }

  // builtin:offline
  if (mapState.basemapId === BUILTIN_OFFLINE) {
    return buildNaturalEarthStyle(
      `pmtiles://${window.location.origin}${ne10Url}`,
    );
  }

  // builtin:empty
  if (mapState.basemapId === BUILTIN_EMPTY) {
    return buildEmptyStyle();
  }

  // pmtiles:
  // format: "mvt"
  // type: "tilelayer"
  // url: "/signalk/pmtiles/finland-estonia.pmtiles"
  // if type=tilelayer and format=mvt, setup vector
  // mvt = pbf
  if (basemap && basemap.url?.toLowerCase().endsWith(".pmtiles")) {
    return buildPmtilesStyle(`${window.location.origin}${basemap.url}`);
  }

  // raster:
  // if type=tilelayer and format=png|jpg, setup raster
  if (basemap && basemap.type === "tilelayer" && basemap.url) {
    return buildRasterStyle(basemap.url);
  }

  // vector / mapstyleJSON:
  // if type=mapstyleJSON, setup vector
  // basemap.format === "pbf" &&
  if (
    basemap &&
    basemap.type === "mapstyleJSON" &&
    (basemap.style || basemap.url)
  ) {
    if (basemap.style) return basemap.style;
    if (basemap.url) return basemap.url;
  }

  // fallback:
  console.warn("using fallback basemap: empty", { basemap });
  mapState.basemapId = BUILTIN_EMPTY;
  return buildEmptyStyle();
}
