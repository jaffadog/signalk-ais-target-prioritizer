import { describe, it, expect } from "vitest";

import {
  attachToVessel,
  takeRecent,
  trailPointLimit,
} from "../src/app/utils/trails";
import { TRAIL_LENGTH } from "../src/engine/constants";
import type { Position } from "../src/types";

// a track running due north, oldest first, as the tracks api returns it
function run(count: number, offset = 0): Position[] {
  return Array.from({ length: count }, (_, i) => [0, offset + i] as Position);
}

describe("trailPointLimit", () => {
  it("converts the trail length into a point count at the plugin's resolution", () => {
    // at 60s per point, an hour of trail is 60 points
    expect(trailPointLimit(60_000)).toBe(TRAIL_LENGTH);
    // at 5s per point it takes twelve times as many
    expect(trailPointLimit(5_000)).toBe(TRAIL_LENGTH * 12);
  });

  it("keeps the window fixed in time whatever the resolution is set to", () => {
    for (const seconds of [1, 5, 30, 60, 120, 300]) {
      const minutes = (trailPointLimit(seconds * 1000) * seconds) / 60;
      expect(minutes).toBeCloseTo(TRAIL_LENGTH, 5);
    }
  });

  it("never returns less than one point for a nonsense resolution", () => {
    expect(trailPointLimit(0)).toBe(1);
    expect(trailPointLimit(-1)).toBe(1);
    expect(trailPointLimit(NaN)).toBe(1);
    expect(trailPointLimit(Infinity)).toBe(1);
  });

  it("errs long, never short, because the resolution is a floor on the interval", () => {
    // the plugin waits for the resolution to elapse *and* a position to arrive, and AIS
    // reception is lossy, so real points are further apart than configured. asking for
    // the configured count therefore reaches further back than TRAIL_LENGTH - which is
    // the safe direction: data inside the window is never trimmed away.
    const configured = 60_000;
    const points = trailPointLimit(configured);
    for (const realInterval of [60_000, 90_000, 180_000]) {
      const minutesCovered = (points * realInterval) / 60_000;
      expect(minutesCovered).toBeGreaterThanOrEqual(TRAIL_LENGTH);
    }
  });
});

describe("takeRecent", () => {
  it("keeps everything when the track is shorter than the window", () => {
    const segments = [run(5)];
    expect(takeRecent(segments, 60)).toEqual(segments);
  });

  it("keeps the newest points, not the oldest", () => {
    const [segment] = takeRecent([run(10)], 3);
    // oldest first, so the tail is the most recent
    expect(segment).toEqual([
      [0, 7],
      [0, 8],
      [0, 9],
    ]);
  });

  it("preserves segment boundaries so a gap stays a gap", () => {
    const result = takeRecent([run(3), run(3, 100)], 6);
    expect(result).toHaveLength(2);
    expect(result[0]).toHaveLength(3);
    expect(result[1]).toHaveLength(3);
  });

  it("drops whole older segments once the window is filled", () => {
    const result = takeRecent([run(5), run(5, 100), run(5, 200)], 5);
    expect(result).toHaveLength(1);
    expect(result[0][0]).toEqual([0, 200]);
  });

  it("trims the oldest surviving segment partially", () => {
    const result = takeRecent([run(5), run(3, 100)], 5);
    // all 3 of the newest segment, plus the last 2 of the older one
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual([
      [0, 3],
      [0, 4],
    ]);
    expect(result[1]).toHaveLength(3);
  });

  it("never returns more points than the window", () => {
    const total = takeRecent([run(50), run(50, 100)], 30).flat().length;
    expect(total).toBe(30);
  });

  it("returns nothing for a zero or negative window", () => {
    expect(takeRecent([run(5)], 0)).toEqual([]);
    expect(takeRecent([run(5)], -1)).toEqual([]);
  });

  it("handles an empty track", () => {
    expect(takeRecent([], 10)).toEqual([]);
  });
});

describe("attachToVessel", () => {
  it("ends the trail at the vessel, not at the last polled point", () => {
    const result = attachToVessel([run(3)], [0, 99]);
    expect(result.at(-1)!.at(-1)).toEqual([0, 99]);
  });

  it("extends the newest segment rather than starting a new one", () => {
    // a new segment would render as a detached fragment instead of a joined leg
    const result = attachToVessel([run(3), run(3, 100)], [0, 200]);
    expect(result).toHaveLength(2);
    expect(result[1]).toHaveLength(4);
    expect(result[0]).toHaveLength(3);
  });

  it("does not repeat a point the poll has already caught up to", () => {
    const segments = [run(3)];
    // [0, 2] is already the newest point
    expect(attachToVessel(segments, [0, 2])).toEqual(segments);
  });

  it("leaves the track alone when the position is missing or nonsense", () => {
    const segments = [run(3)];
    expect(attachToVessel(segments, undefined)).toEqual(segments);
    expect(attachToVessel(segments, [NaN, 5])).toEqual(segments);
    expect(attachToVessel(segments, [5, NaN])).toEqual(segments);
    expect(attachToVessel(segments, [Infinity, 5])).toEqual(segments);
  });

  it("starts a trail from the vessel when there is no track yet", () => {
    // one segment holding the single live position
    expect(attachToVessel([], [1, 2])).toEqual([[[1, 2]]]);
  });

  it("does not mutate the track it was given", () => {
    const segments = [run(3)];
    const before = structuredClone(segments);
    attachToVessel(segments, [0, 50]);
    expect(segments).toEqual(before);
  });

  it("keeps the trail attached across repeated ticks between polls", () => {
    // the vessel moves every tick while the track stays put, which is the whole bug
    const polled = [run(3)];
    for (const lat of [10, 11, 12, 13]) {
      const drawn = attachToVessel(polled, [0, lat]);
      expect(drawn.at(-1)!.at(-1)).toEqual([0, lat]);
      // and the live leg never accumulates - one point per tick, not one per tick ever
      expect(drawn.flat()).toHaveLength(4);
    }
  });
});

describe("windowing a long track", () => {
  it("cuts a long track down to the trail length, keeping the newest points", () => {
    const segments = [run(5_000)];
    const windowed = takeRecent(segments, trailPointLimit(60_000));

    expect(windowed.flat()).toHaveLength(TRAIL_LENGTH);
    // the newest point survives, so the trail stays attached to the vessel
    expect(windowed.at(-1)!.at(-1)).toEqual([0, 4_999]);
  });

  it("leaves a vessel newly in range with every point it has", () => {
    const segments = [run(4)];
    expect(takeRecent(segments, trailPointLimit(60_000))).toEqual(segments);
  });
});
