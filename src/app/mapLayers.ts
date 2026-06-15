//mapLayers.ts

import { mapState } from "../engine/map.svelte";

export function toggleOpenSeaMap(visible: boolean) {
  if (
    !mapState.instance ||
    !mapState.loaded ||
    !mapState.instance.getLayer("openseamap")
  )
    return;

  if (visible) {
    mapState.instance.setLayoutProperty("openseamap", "visibility", "visible");
  } else {
    mapState.instance.setLayoutProperty("openseamap", "visibility", "none");
  }
}
