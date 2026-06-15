import type { Map, StyleSpecification } from "maplibre-gl";
import { basemaps } from "../app/basemaps.svelte";
import { buildStyle } from "../app/resolveMapConfig";
import { ui } from "../app/ui.svelte";

export const mapState = $state<{
  instance: Map | null;
  loaded: boolean;
  basemapId: string;
  styleId: string;
  openSeaMap: boolean;
}>({
  instance: null,
  loaded: false,
  basemapId: getInitialBasemapId(),
  styleId: "",
  openSeaMap: localStorage.getItem("openseamap") === "true",
});

function getInitialBasemapId(): string {
  const basemapId: string | null = localStorage.getItem("basemap");
  return basemapId && basemapId in basemaps ? basemapId : "street";
}

export function setStyle() {
  console.log("ENTER setStyle", mapState.basemapId, ui.darkMode);
  // FIXME style load state?
  if (!mapState.instance || !mapState.loaded) {
    console.log("BAIL setStyle", mapState.instance, mapState.loaded);
    return;
  }

  const style: StyleSpecification = buildStyle();
  const styleId: string = getStyleId();

  console.log("style", style);
  if (!style) return;

  if (mapState.styleId === styleId) {
    console.log(">>> skipping applying this style, as its already loaded");
    return;
  }

  console.log(">>> applying new style");
  mapState.instance.setStyle(style);
  mapState.styleId = styleId;

  mapState.instance.once("style.load", () => {
    console.log("new style load complete");
  });
}

export function getStyleId(): string {
  return `${mapState.basemapId}-${String(ui.darkMode)}`;
}
