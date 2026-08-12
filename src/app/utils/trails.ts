// pure geometry helpers for drawing past positions - see IMO SN.1/Circ.243/Rev.2

import { TRAIL_LENGTH } from "../../engine/constants";
import type { Position } from "../../types";

/**
 * How many track points make up TRAIL_LENGTH at the plugin's configured resolution. The
 * plugin's own retention is set for whatever else consumes it - measured at nearly five
 * hours on a live server - which is far more than a collision avoidance plot wants.
 *
 * The resolution is a floor on the real interval, not the interval itself: the plugin
 * adds a point when a position arrives *and* the resolution has elapsed, and AIS
 * reception is lossy, so points really arrive further apart than configured. That makes
 * this an over-estimate of the points needed, which is the safe direction - a trail can
 * come out longer than TRAIL_LENGTH, but data inside the window is never trimmed away.
 */
export function trailPointLimit(resolutionMs: number): number {
  if (!Number.isFinite(resolutionMs) || resolutionMs <= 0) return 1;
  return Math.max(1, Math.ceil((TRAIL_LENGTH * 60_000) / resolutionMs));
}

/**
 * The newest maxPoints positions, keeping the api's segment boundaries so a gap in the
 * track stays a gap rather than being closed by a line the vessel never sailed. A track
 * shorter than the window is kept whole, so a vessel just come into range shows every
 * point it has.
 */
export function takeRecent(
  segments: Position[][],
  maxPoints: number,
): Position[][] {
  if (maxPoints <= 0) return [];
  const recent: Position[][] = [];
  let remaining = maxPoints;
  for (let i = segments.length - 1; i >= 0 && remaining > 0; i--) {
    const segment = segments[i];
    const take = Math.min(segment.length, remaining);
    recent.unshift(segment.slice(segment.length - take));
    remaining -= take;
  }
  return recent;
}
