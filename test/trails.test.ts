import { describe, it, expect } from "vitest";

import {
  dotStride,
  takeRecent,
  thinDots,
  trailPointLimit,
} from "../src/app/utils/trails";
import {
  METERS_PER_NM,
  TRAIL_DOT_REFERENCE_SPEED,
  TRAIL_DOT_SPACING,
  TRAIL_LENGTH,
} from "../src/engine/constants";
import type { Position } from "../src/types";

// a run of positions, oldest first, matching the tracks api's ordering
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

  it("keeps the window fixed in time however the plugin is configured", () => {
    for (const resolutionMs of [1_000, 5_000, 30_000, 60_000, 120_000]) {
      const minutes = (trailPointLimit(resolutionMs) * resolutionMs) / 60_000;
      expect(minutes).toBeCloseTo(TRAIL_LENGTH, 5);
    }
  });

  it("never returns less than one point for a nonsense resolution", () => {
    expect(trailPointLimit(0)).toBe(1);
    expect(trailPointLimit(-1)).toBe(1);
    expect(trailPointLimit(NaN)).toBe(1);
  });
});

describe("dotStride", () => {
  // distance a reference-speed vessel covers between two track points
  const metersPerDot = (resolutionMs: number) =>
    ((TRAIL_DOT_REFERENCE_SPEED * METERS_PER_NM) / 3600) *
    (resolutionMs / 1000);

  it("does not thin when the dots are already far enough apart", () => {
    // one metre per pixel: a 60s gap at 10 kn is ~309 px, well over the target
    expect(dotStride(1, 60_000)).toBe(1);
  });

  it("thins harder as metres per pixel grows (zooming out)", () => {
    const strides = [1, 10, 100, 1000, 10_000].map((mpp) =>
      dotStride(mpp, 60_000),
    );
    for (let i = 1; i < strides.length; i++) {
      expect(strides[i]).toBeGreaterThanOrEqual(strides[i - 1]);
    }
    expect(strides.at(-1)!).toBeGreaterThan(strides[0]);
  });

  it("doubles the stride when metres per pixel doubles, once thinning has kicked in", () => {
    // each zoom level out doubles metres per pixel
    const base = dotStride(1000, 60_000);
    expect(dotStride(2000, 60_000)).toBeCloseTo(base * 2, 0);
  });

  it("lands near the target pixel spacing at the reference speed", () => {
    const resolutionMs = 60_000;
    for (const mpp of [50, 200, 800]) {
      const stride = dotStride(mpp, resolutionMs);
      const spacingPx = (metersPerDot(resolutionMs) * stride) / mpp;
      // rounding to a whole stride cannot hit the target exactly
      expect(spacingPx).toBeGreaterThan(TRAIL_DOT_SPACING / 2);
      expect(spacingPx).toBeLessThan(TRAIL_DOT_SPACING * 2);
    }
  });

  it("thins more at a finer plugin resolution, since the dots start closer together", () => {
    expect(dotStride(500, 5_000)).toBeGreaterThan(dotStride(500, 60_000));
  });

  it("never returns less than one for nonsense inputs", () => {
    expect(dotStride(0, 60_000)).toBe(1);
    expect(dotStride(-1, 60_000)).toBe(1);
    expect(dotStride(NaN, 60_000)).toBe(1);
    expect(dotStride(100, 0)).toBe(1);
    expect(dotStride(100, NaN)).toBe(1);
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

describe("thinDots", () => {
  it("is a no-op at stride 1", () => {
    const dots = run(5);
    expect(thinDots(dots, 1)).toEqual(dots);
    expect(thinDots(dots, 0)).toEqual(dots);
  });

  it("keeps the newest dot, so the trail stays attached to the vessel", () => {
    const thinned = thinDots(run(10), 3);
    expect(thinned[0]).toEqual([0, 9]);
  });

  it("keeps every stride-th dot counting back from the newest", () => {
    expect(thinDots(run(10), 3)).toEqual([
      [0, 9],
      [0, 6],
      [0, 3],
      [0, 0],
    ]);
  });

  it("keeps the dots equally spaced, which is what the standard requires", () => {
    const thinned = thinDots(run(21), 4);
    const gaps = thinned.slice(1).map((p, i) => Math.abs(p[1] - thinned[i][1]));
    expect(new Set(gaps)).toEqual(new Set([4]));
  });

  it("reduces the count by about the stride", () => {
    expect(thinDots(run(100), 10)).toHaveLength(10);
    expect(thinDots(run(60), 2)).toHaveLength(30);
  });

  it("always leaves at least the newest dot", () => {
    expect(thinDots(run(3), 100)).toEqual([[0, 2]]);
  });

  it("handles an empty list", () => {
    expect(thinDots([], 5)).toEqual([]);
  });
});

describe("windowing and thinning together", () => {
  it("windows first, then thins, and never exceeds the window", () => {
    const segments = [run(500)];
    const limit = trailPointLimit(60_000);
    const windowed = takeRecent(segments, limit);
    const drawn = thinDots(windowed.flat(), dotStride(1000, 60_000));

    expect(windowed.flat().length).toBe(limit);
    expect(drawn.length).toBeLessThanOrEqual(limit);
    // and the newest point survives both steps
    expect(drawn[0]).toEqual([0, 499]);
  });
});
