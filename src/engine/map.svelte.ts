import type { Map, StyleSpecification } from "maplibre-gl";
import { buildStyle } from "../app/resolveMapConfig";
import { ui } from "../app/ui.svelte";
import { DEFAULT_BASEMAP } from "./constants";

export const mapState = $state<{
  instance: Map | null;
  loaded: boolean;
  basemapId: string;
  styleId: string | null;
  openSeaMap: boolean;
}>({
  instance: null,
  loaded: false,
  basemapId: localStorage.getItem("basemap") ?? DEFAULT_BASEMAP,
  styleId: null,
  openSeaMap: localStorage.getItem("openseamap") === "true",
});

export function setStyle() {
  console.log("ENTER setStyle", mapState.basemapId, ui.darkMode);
  if (
    !mapState.instance ||
    !mapState.loaded ||
    !mapState.instance.isStyleLoaded
  ) {
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
