import ky from "ky";
import {
  CHECK_ONLINE_INTERVAL,
  CHECK_ONLINE_TIMEOUT,
  PROBE_URL,
} from "../engine/constants";
import { mapState } from "./map.svelte";
import { basemaps, DEFAULT_OFFLINE_BASEMAP } from "./basemaps.svelte";
import { toggleOpenSeaMap } from "./mapLayers";
import { toaster } from "./utils/toaster";

// connectivity.svelte.ts
export const connectivity = $state({
  online: undefined as boolean | undefined,
});

export async function getConnectivity(): Promise<boolean> {
  try {
    await ky.head(PROBE_URL, {
      timeout: CHECK_ONLINE_TIMEOUT,
      mode: "no-cors",
      retry: 0, // we'll handle retry logic ourselves
      throwHttpErrors: false, // opaque responses always report status 0 / ok:false — meaningless here
    });
    return true;
  } catch (e) {
    console.warn("OFFLINE:", e);
    return false;
  }
}

let prevOnline: boolean | undefined;
let attempt = 0;
const retryLimit = 2;

export async function checkConnectivity(): Promise<void> {
  attempt++;
  const online = await getConnectivity();

  // console.log("TRY checkConnectivity", {
  //   prevOnline,
  //   online,
  //   attempt,
  //   retryLimit,
  // });

  // retry only if we transition from online to offline
  if (prevOnline && !online && attempt < retryLimit) {
    // console.log("RETRY checkConnectivity");
    setTimeout(checkConnectivity, 5000);
    return;
  }

  attempt = 0;

  connectivity.online = online;

  if (!connectivity.online) {
    if (basemaps[mapState.basemapId]?.online) {
      mapState.basemapId = DEFAULT_OFFLINE_BASEMAP;
    }
    mapState.openSeaMap = false;
    toggleOpenSeaMap(false);
  }

  if (prevOnline === false && connectivity.online) {
    toaster.success({
      title: "Online",
      description:
        "You are online. Map layers that require internet access have been enabled",
      duration: 5000,
    });
  } else if (prevOnline !== false && !connectivity.online) {
    toaster.warning({
      title: "Offline",
      description:
        "You are offline. Map layers that require internet access have been disabled",
      duration: 5000,
    });
  }

  prevOnline = connectivity.online;
  console.log(">>> EXIT checkConnectivity", connectivity.online);
}

// check periodically
setInterval(checkConnectivity, CHECK_ONLINE_INTERVAL);
