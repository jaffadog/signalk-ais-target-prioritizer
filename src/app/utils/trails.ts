// pure geometry helpers for drawing past positions - see IMO SN.1/Circ.243/Rev.2

import {
  METERS_PER_NM,
  TRAIL_DOT_REFERENCE_SPEED,
  TRAIL_DOT_SPACING,
  TRAIL_LENGTH,
} from "../../engine/constants";
import type { Position } from "../../types";

/**
 * How many track points make up TRAIL_LENGTH at the tracks plugin's configured
 * resolution. The plugin's own retention is set for whatever else consumes it,
 * which is far more than a collision avoidance plot wants.
 */
export function trailPointLimit(resolutionMs: number): number {
  if (!Number.isFinite(resolutionMs) || resolutionMs <= 0) return 1;
  return Math.max(1, Math.ceil((TRAIL_LENGTH * 60_000) / resolutionMs));
}

/**
 * How many dots to skip so a vessel making TRAIL_DOT_REFERENCE_SPEED shows dots
 * roughly TRAIL_DOT_SPACING pixels apart, whatever the zoom.
 *
 * Deliberately keyed off one reference speed rather than each vessel's own, so
 * every target shares a stride: the time step stays identical across targets and
 * relative speed stays readable, the interval just widens by a whole multiple.
 */
export function dotStride(
  metersPerPixel: number,
  resolutionMs: number,
): number {
  if (!Number.isFinite(metersPerPixel) || metersPerPixel <= 0) return 1;
  if (!Number.isFinite(resolutionMs) || resolutionMs <= 0) return 1;

  const metersPerDot =
    ((TRAIL_DOT_REFERENCE_SPEED * METERS_PER_NM) / 3600) *
    (resolutionMs / 1000);
  const pixelsPerDot = metersPerDot / metersPerPixel;
  if (!pixelsPerDot) return 1;

  return Math.max(1, Math.round(TRAIL_DOT_SPACING / pixelsPerDot));
}

/**
 * The newest maxPoints positions, keeping the api's segment boundaries so a gap
 * in the track stays a gap rather than being closed by a line the vessel never
 * sailed.
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

/**
 * Keep every stride-th dot, counting back from the newest so the trail stays
 * attached to the vessel rather than drifting behind it.
 */
export function thinDots(coordinates: Position[], stride: number): Position[] {
  if (stride <= 1) return coordinates;
  const thinned: Position[] = [];
  for (let i = coordinates.length - 1; i >= 0; i -= stride) {
    thinned.push(coordinates[i]);
  }
  return thinned;
}
