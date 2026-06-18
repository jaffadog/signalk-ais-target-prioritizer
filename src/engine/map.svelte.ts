import type { Map, StyleSpecification } from "maplibre-gl";
import { buildStyle } from "../app/resolveMapConfig";
import { ui } from "../app/ui.svelte";
import { DEFAULT_BASEMAP } from "./constants";
import { name as PLUGIN_ID } from "../../package.json";

export const mapState = $state<{
  instance: Map | null;
  loaded: boolean;
  basemapId: string;
  styleId: string | null;
  openSeaMap: boolean;
  protomapsFontsAvailable: boolean;
  fontsDownloading: boolean;
}>({
  instance: null,
  loaded: false,
  basemapId: localStorage.getItem("basemap") ?? DEFAULT_BASEMAP,
  styleId: null,
  openSeaMap: localStorage.getItem("openseamap") === "true",
  protomapsFontsAvailable:
    localStorage.getItem("protomapsFontsAvailable") === "true",
  fontsDownloading: false,
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

export async function checkFontsAvailable() {
  const res = await fetch(`/plugins/${PLUGIN_ID}/fonts-available`).catch(
    () => null,
  );
  mapState.protomapsFontsAvailable = res?.ok ?? false;
}

export async function handleDownloadFonts() {
  mapState.fontsDownloading = true;
  await fetch(`/plugins/${PLUGIN_ID}/download-fonts`, { method: "POST" });
  mapState.fontsDownloading = false;
  await checkFontsAvailable();
}

export async function handleRemoveFonts() {
  await fetch(`/plugins/${PLUGIN_ID}/remove-fonts`, { method: "POST" });
  await checkFontsAvailable();
}
