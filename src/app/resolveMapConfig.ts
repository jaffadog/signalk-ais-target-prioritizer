import type { StyleSpecification } from "maplibre-gl";
import {
  buildEmptyStyle,
  buildNaturalEarthStyle,
  buildPmtilesStyle,
  buildRasterStyle,
} from "./styleBuilders";
import { basemaps } from "./basemaps.svelte";
import { mapState } from "./map.svelte";
import { ui } from "./ui.svelte";
import ne10Url from "../app/assets/ne_10m_land.pmtiles?url";

export function buildStyle(): StyleSpecification | string {
  console.log("enter resolveMapConfig", mapState.basemapId, ui.darkMode);
  const theme = ui.darkMode ? "dark" : "light";
  const basemap = basemaps[mapState.basemapId];
  if (!basemap) {
    mapState.basemapId = "empty";
    return buildEmptyStyle(theme);
  }

  // if id=street, eval dark mode and setup carto light or dark
  if (
    mapState.basemapId === "builtin:street" &&
    basemap.styleLight &&
    basemap.styleDark
  ) {
    return ui.darkMode ? basemap.styleDark : basemap.styleLight;
  }

  // if id=sat, setup raster
  if (mapState.basemapId === "builtin:satellite" && basemap.url) {
    return buildRasterStyle(basemap.url);
  }

  // if id=offline, setup offline - set colors light or dark
  if (mapState.basemapId === "builtin:offline") {
    return buildNaturalEarthStyle({
      url: `pmtiles://${window.location.origin}${ne10Url}`,
      theme: theme,
    });
  }

  // if id=empty, setup empty - set colors light or dark
  if (mapState.basemapId === "builtin:empty") {
    return buildEmptyStyle(theme);
  }

  // format: "mvt"
  // type: "tilelayer"
  // url: "/signalk/pmtiles/finland-estonia.pmtiles"
  // if type=tilelayer and format=mvt, setup vector
  // mvt = pbf
  if (basemap.url?.toLowerCase().endsWith(".pmtiles")) {
    return buildPmtilesStyle(`${window.location.origin}${basemap.url}`, theme);
  }

  // if type=tilelayer and format=png|jpg, setup raster
  if (basemap.type === "tilelayer" && basemap.url) {
    return buildRasterStyle(basemap.url);
  }

  // if type=mapstyleJSON, setup vector
  if (
    basemap.type === "mapstyleJSON" &&
    basemap.format === "pbf" &&
    basemap.style
  ) {
    return basemap.style;
  }

  // FIXME fallback:
  mapState.basemapId = "empty";
  return buildEmptyStyle(theme);
}
