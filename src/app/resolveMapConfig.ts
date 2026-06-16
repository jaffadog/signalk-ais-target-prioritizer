import type { StyleSpecification } from "maplibre-gl";
import {
  buildCartoDarkStyle,
  buildCartoPositronStyle,
  buildEmptyStyle,
  buildEsriSatelliteStyle,
  buildOfflineStyle,
  buildPmtilesStyle,
} from "./styleBuilders";
import { basemaps } from "./basemaps.svelte";
import { mapState } from "../engine/map.svelte";
import { toaster } from "./utils/toaster";
import { ui } from "./ui.svelte";

export function buildStyle(): StyleSpecification {
  console.log("enter resolveMapConfig", mapState.basemapId, ui.darkMode);
  const type = basemaps[mapState.basemapId].type;
  const theme = ui.darkMode ? "dark" : "light";

  try {
    switch (type) {
      case "carto-vector": {
        return ui.darkMode ? buildCartoDarkStyle() : buildCartoPositronStyle();
      }
      case "raster": {
        return buildEsriSatelliteStyle();
      }
      case "offline": {
        return buildOfflineStyle(theme);
      }
      case "signalk-protomaps-pmtiles": {
        return buildPmtilesStyle(
          `${window.location.origin}/signalk/pmtiles/${mapState.basemapId}`,
          theme,
        );
      }
      default: {
        console.error("no such basemap", mapState.basemapId);
      }
      // eslint-disable-next-line no-fallthrough
      case "empty": {
        return buildEmptyStyle(theme);
      }
    }
  } catch (e) {
    console.error(e);
    toaster.error({
      title: "Error",
      description: `Unable to load ${mapState.basemapId} layer.`,
      duration: Infinity,
    });

    mapState.basemapId = "empty";
    return buildEmptyStyle(theme);
  }
}
