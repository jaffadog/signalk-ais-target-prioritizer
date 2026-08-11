// past positions (vessel trails) sourced from the @signalk/tracks-plugin track
// api. that plugin is a shared signal k resource: it already accumulates one
// point per configured time resolution and keeps a sliding window, so we get
// history immediately at startup instead of building our own buffer from empty,
// and the points are equally spaced by time as IMO SN.1/Circ.243 requires.

import {
  DEFAULT_TRACK_RESOLUTION,
  TRACKS_REFRESH_INTERVAL,
} from "../engine/constants";
import type { Tracks } from "../types";
import { getTrackResolution, getTracks } from "./utils/api";

export const tracksState = $state<{
  tracks: Tracks;
  available: boolean;
  resolution: number;
}>({
  tracks: {},
  available: false,
  resolution: DEFAULT_TRACK_RESOLUTION,
});

let timeoutId: ReturnType<typeof setTimeout> | undefined;

// read once: the plugin's resolution only changes when it is reconfigured, which
// restarts the plugin anyway. falls back to the plugin default when the config is
// not readable (a non-admin session cannot see it).
async function refreshResolution() {
  try {
    tracksState.resolution =
      (await getTrackResolution()) ?? DEFAULT_TRACK_RESOLUTION;
  } catch {
    tracksState.resolution = DEFAULT_TRACK_RESOLUTION;
  }
}

export async function refreshTracks() {
  try {
    tracksState.tracks = await getTracks();
    tracksState.available = true;
  } catch {
    // the tracks plugin is optional - trails are simply absent without it
    tracksState.tracks = {};
    tracksState.available = false;
  }
}

export function startTracksLoop() {
  if (timeoutId) return;
  refreshResolution();
  tracksLoop();
}

function tracksLoop() {
  refreshTracks();
  timeoutId = setTimeout(tracksLoop, TRACKS_REFRESH_INTERVAL);
}

export function stopTracksLoop() {
  clearTimeout(timeoutId);
  timeoutId = undefined;
}
