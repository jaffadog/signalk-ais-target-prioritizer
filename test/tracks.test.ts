import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { DEFAULT_TRACK_RESOLUTION } from "../src/engine/constants";
import type { Tracks } from "../src/types";
import type { Context } from "@signalk/server-api";

// the tracks plugin is optional, so both calls have to be allowed to fail
const getTracks = vi.fn();
const getTrackResolution = vi.fn();

vi.mock("../src/app/utils/api", () => ({
  getTracks: (...a: unknown[]) => getTracks(...a),
  getTrackResolution: (...a: unknown[]) => getTrackResolution(...a),
}));

const { refreshTracks, startTracksLoop, stopTracksLoop, tracksState } =
  await import("../src/app/tracks.svelte");

const CTX = "vessels.urn:mrn:imo:mmsi:230941380" as Context;

const payload = (): Tracks =>
  ({
    [CTX]: {
      type: "MultiLineString",
      coordinates: [
        [
          [24.7, 59.7],
          [24.8, 59.8],
        ],
      ],
    },
  }) as Tracks;

beforeEach(() => {
  stopTracksLoop();
  getTracks.mockReset();
  getTrackResolution.mockReset();
  tracksState.tracks = {};
  tracksState.available = false;
  tracksState.resolution = DEFAULT_TRACK_RESOLUTION;
});

afterEach(() => {
  stopTracksLoop();
  vi.useRealTimers();
});

describe("refreshTracks", () => {
  it("stores what the api returns and marks tracks available", async () => {
    getTracks.mockResolvedValue(payload());

    await refreshTracks();

    expect(tracksState.available).toBe(true);
    expect(Object.keys(tracksState.tracks)).toEqual([CTX]);
  });

  // a 404 just means the optional plugin is not enabled
  it("clears the tracks and marks unavailable when the api fails", async () => {
    getTracks.mockResolvedValue(payload());
    await refreshTracks();
    expect(tracksState.available).toBe(true);

    getTracks.mockRejectedValue(new Error("404"));
    await refreshTracks();

    expect(tracksState.available).toBe(false);
    expect(tracksState.tracks).toEqual({});
  });

  it("recovers if the plugin comes back", async () => {
    getTracks.mockRejectedValue(new Error("404"));
    await refreshTracks();

    getTracks.mockResolvedValue(payload());
    await refreshTracks();

    expect(tracksState.available).toBe(true);
    expect(Object.keys(tracksState.tracks)).toHaveLength(1);
  });

  it("replaces the previous payload rather than merging into it", async () => {
    getTracks.mockResolvedValue(payload());
    await refreshTracks();

    getTracks.mockResolvedValue({} as Tracks);
    await refreshTracks();

    expect(tracksState.tracks).toEqual({});
  });
});

describe("resolution", () => {
  it("reads the plugin's configured resolution when the loop starts", async () => {
    getTracks.mockResolvedValue({});
    getTrackResolution.mockResolvedValue(5000);

    startTracksLoop();
    await vi.waitFor(() => expect(tracksState.resolution).toBe(5000));
  });

  it("falls back to the plugin default when the config is not readable", async () => {
    getTracks.mockResolvedValue({});
    // a non-admin session cannot read /skServer/plugins
    getTrackResolution.mockRejectedValue(new Error("403"));

    startTracksLoop();
    await vi.waitFor(() =>
      expect(tracksState.resolution).toBe(DEFAULT_TRACK_RESOLUTION),
    );
  });

  it("falls back when the config has no resolution set", async () => {
    getTracks.mockResolvedValue({});
    getTrackResolution.mockResolvedValue(undefined);

    startTracksLoop();
    await vi.waitFor(() =>
      expect(tracksState.resolution).toBe(DEFAULT_TRACK_RESOLUTION),
    );
  });
});

describe("the polling loop", () => {
  it("fetches immediately on start rather than waiting out the interval", async () => {
    getTracks.mockResolvedValue(payload());
    getTrackResolution.mockResolvedValue(60000);

    startTracksLoop();

    await vi.waitFor(() => expect(getTracks).toHaveBeenCalled());
  });

  it("does not start a second loop if it is already running", async () => {
    getTracks.mockResolvedValue({});
    getTrackResolution.mockResolvedValue(60000);

    startTracksLoop();
    await vi.waitFor(() => expect(getTracks).toHaveBeenCalledTimes(1));

    startTracksLoop();
    startTracksLoop();

    // still just the one fetch from the first start
    expect(getTracks).toHaveBeenCalledTimes(1);
  });

  it("stops polling when stopped, which is the point of the settings toggle", async () => {
    vi.useFakeTimers();
    getTracks.mockResolvedValue({});
    getTrackResolution.mockResolvedValue(60000);

    startTracksLoop();
    await vi.waitFor(() => expect(getTracks).toHaveBeenCalledTimes(1));

    stopTracksLoop();
    await vi.advanceTimersByTimeAsync(5 * 60_000);

    expect(getTracks).toHaveBeenCalledTimes(1);
  });

  it("can be restarted after being stopped", async () => {
    getTracks.mockResolvedValue({});
    getTrackResolution.mockResolvedValue(60000);

    startTracksLoop();
    await vi.waitFor(() => expect(getTracks).toHaveBeenCalledTimes(1));
    stopTracksLoop();

    startTracksLoop();
    await vi.waitFor(() => expect(getTracks).toHaveBeenCalledTimes(2));
  });

  it("is safe to stop when never started", () => {
    expect(() => stopTracksLoop()).not.toThrow();
  });
});
