import type { Map } from "maplibre-gl";
import { buildStyle } from "./resolveMapConfig";
import { ui } from "./ui.svelte";
import { name as PLUGIN_ID } from "../../package.json";
import { basemaps, DEFAULT_BASEMAP } from "./basemaps.svelte";
import { addSharedLayers } from "./layers";
import { addSharedSources } from "./sources";

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

export function setStyle({ force = false } = {}) {
  if (
    !mapState.instance ||
    !mapState.loaded ||
    !mapState.instance.isStyleLoaded
  )
    return;
  // get style
  const style = buildStyle();
  const styleId = getStyleId();

  if (!style) return;

  if (mapState.styleId === styleId && force === false) {
    console.log(">>> skipping applying this style, as its already loaded");
    return;
  }

  // add our custom sources and layers after the style loads:
  mapState.instance.once("style.load", () => {
    addSharedSources();
    addSharedLayers();
  });

  // apply style
  mapState.instance.setStyle(style); // , { diff: true } keeps custom layers and sources? {diff: true}
  mapState.styleId = styleId;
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
  if (
    basemaps[mapState.basemapId].type === "signalk-protomaps-pmtiles" &&
    mapState.protomapsFontsAvailable
  ) {
    setStyle({ force: true });
  }
}

export async function handleRemoveFonts() {
  await fetch(`/plugins/${PLUGIN_ID}/remove-fonts`, { method: "POST" });
  await checkFontsAvailable();
  if (
    basemaps[mapState.basemapId].type === "signalk-protomaps-pmtiles" &&
    !mapState.protomapsFontsAvailable
  ) {
    setStyle({ force: true });
  }
}
