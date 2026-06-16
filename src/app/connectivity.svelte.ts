import {
  CHECK_ONLINE_INTERVAL,
  DEFAULT_OFFLINE_BASEMAP,
} from "../engine/constants";
import { mapState } from "../engine/map.svelte";
import { basemaps } from "./basemaps.svelte";
import { toggleOpenSeaMap } from "./mapLayers";
import { toaster } from "./utils/toaster";

// connectivity.svelte.ts
export const connectivity = $state({
  online: undefined as boolean | undefined,
});

export async function getConnectivity(): Promise<boolean> {
  //   console.log("ENTER getConnectivity");
  //   const start = performance.now();

  let online: boolean = false;

  try {
    await fetch("https://www.google.com/favicon.ico", {
      method: "HEAD",
      signal: AbortSignal.timeout(3000),
      mode: "no-cors", // bypass CORS — won't throw on block, just on network failure
    });
    online = true;
  } catch {
    // ignore
  }

  return online;
}

let prevOnline: boolean | undefined = undefined;

export function checkConnectivity(): Promise<void> {
  console.log(">>> ENTER checkConnectivity");
  return getConnectivity().then((online: boolean) => {
    if (!online) {
      if (basemaps[mapState.basemapId]?.online) {
        mapState.basemapId = DEFAULT_OFFLINE_BASEMAP;
      }
      mapState.openSeaMap = false;
      toggleOpenSeaMap(false);
    }

    connectivity.online = online;

    if (prevOnline === false && online) {
      toaster.success({
        title: "Online",
        description:
          "Internet access detected. Map layers that require internet access have been enabled",
        duration: 5000,
      });
    } else if (prevOnline !== false && !online) {
      toaster.warning({
        title: "Offline",
        description:
          "No internet access detected. Map layers that require internet access have been disabled",
        duration: 5000,
      });
    }

    prevOnline = online;
    console.log(">>> EXIT checkConnectivity", connectivity.online);
  });
}

// check periodically
setInterval(checkConnectivity, CHECK_ONLINE_INTERVAL);
