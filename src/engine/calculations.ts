// pure functions - range, bearing, cpa, tcpa

import destination from "@turf/destination";

import { KNOTS_PER_M_PER_S, METERS_PER_NM, R } from "./constants";
import {
  COURSE_PROJECTION_MINUTES,
  CPA_CEILING_NM,
  LOST_VESSEL_WARNING_AGE,
  ORDER_CLOSING,
  ORDER_DANGER,
  ORDER_OPENING,
  ORDER_WARNING,
  RANGE_CEILING_NM,
  TCPA_CEILING,
  TIEBREAK_MAX,
} from "./constants";
import type { Position, Vessel } from "../types";
import type { Vector2D } from "../types";
import type { CollisionProfile } from "../types";

export function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function toDeg(radians: number): number {
  return (radians * 180) / Math.PI;
}

// equirectangular projection
export function calcProjection(v: Vessel, m: Vessel): Vector2D | undefined {
  if (
    v.latitude === null ||
    v.longitude === null ||
    m.latitude === null ||
    m.longitude === null
  )
    return;
  const x = toRad(v.longitude - m.longitude) * Math.cos(toRad(m.latitude)) * R;
  const y = toRad(v.latitude - m.latitude) * R;
  return { x, y };
}

export function calcRange(p: Vector2D): number {
  return Math.sqrt(p.x * p.x + p.y * p.y);
}

export function calcBearing(p: Vector2D): number {
  return (toDeg(Math.atan2(p.x, p.y)) + 360) % 360;
}

// sog in m/s, cog in radians
export function calcVelocity(v: Vessel): Vector2D {
  // if we dont have sog or cog, assume the vessel is not moving and proceed with cpa calc
  if (v.sog === null || v.cog === null) return { x: 0, y: 0 };

  return {
    x: v.sog * Math.sin(v.cog),
    y: v.sog * Math.cos(v.cog),
  };
}

export function calcCpa(
  projection: Vector2D,
  velocity: Vector2D,
  myVelocity: Vector2D,
): { tcpa: number; cpa: number } | undefined {
  if (!projection || !velocity || !myVelocity) return;

  const v = {
    x: velocity.x - myVelocity.x,
    y: velocity.y - myVelocity.y,
  };

  const v2 = v.x * v.x + v.y * v.y;
  if (v2 < 0.0001) return;

  const t = -(projection.x * v.x + projection.y * v.y) / v2;
  // if cpa was in the past:
  // could set it to 0, or cancel the cpa calc, or leave it as is
  if (t < 0) return;

  const cx = projection.x + v.x * t;
  const cy = projection.y + v.y * t;

  return {
    tcpa: t,
    cpa: Math.sqrt(cx * cx + cy * cy),
  };
}

export function calcCpaLocation(v: Vessel, tcpa: number): Position | undefined {
  if (
    v.latitude === null ||
    v.longitude === null ||
    v.cog === null ||
    v.sog === null ||
    tcpa === undefined
  )
    return;

  const end = destination(
    [v.longitude, v.latitude],
    v.sog * tcpa,
    toDeg(v.cog),
    {
      units: "meters",
    },
  );

  return end.geometry.coordinates as Position;
}

// export function isCpaAhead() {
//   myPos: [number, number],
//   myHeading: number,
//   cpaPosition: [number, number]
// ): boolean {
//   const bearingToCpa = bearing(myPos, cpaPosition); // use turf.js or your own bearing calc
//   const diff = ((bearingToCpa - myHeading + 540) % 360) - 180; // normalize to -180..180
//   return Math.abs(diff) < 90; // within 90° of heading = ahead
// }

export function calcPredictedLocation(v: Vessel): Position | undefined {
  if (
    v.latitude === null ||
    v.longitude === null ||
    v.cog === null ||
    v.sog === null
  )
    return;

  const end = destination(
    [v.longitude, v.latitude],
    v.sog * 60 * COURSE_PROJECTION_MINUTES,
    toDeg(v.cog),
    {
      units: "meters",
    },
  );

  return end.geometry.coordinates as Position;
}

export function calcLastSeenSecondsAgo(v: Vessel): number | undefined {
  if (!v.lastSeenDate) return;
  const diff = Math.round(
    (new Date().getTime() - new Date(v.lastSeenDate).getTime()) / 1000,
  );
  return diff > 0 ? diff : 0;
}

export function calcIsLost(lastSeenSecondsAgo: number): boolean {
  return (
    !isValidNumber(lastSeenSecondsAgo) ||
    lastSeenSecondsAgo > LOST_VESSEL_WARNING_AGE
  );
}

export function calcIsValid(v: Vessel): boolean {
  return isValidNumber(v.latitude) && isValidNumber(v.longitude);
}

/**
 * Scale a value onto 0..TIEBREAK_MAX, flattening at `ceiling`. Clamping is the
 * point: it keeps a tie breaker from growing large enough to push a target out of
 * its own priority band.
 */
export function tiebreak(value: number, ceiling: number): number {
  if (!(ceiling > 0)) return 0;
  const clamped = Math.min(Math.max(value, 0), ceiling);
  return (TIEBREAK_MAX * clamped) / ceiling;
}

export function calcAlarms(
  activeCollisionProfile: CollisionProfile,
  range: number | undefined,
  sog: number | null,
  cpa: number | undefined,
  tcpa: number | undefined,
  mmsi: string | null,
) {
  const alarms: {
    guardAlarm?: boolean;
    collisionAlarm?: boolean;
    collisionWarning?: boolean;
    sartAlarm?: boolean;
    mobAlarm?: boolean;
    epirbAlarm?: boolean;
    alarmState?: string | null;
    alarmType?: string | null;
    order?: number;
  } = {};

  try {
    // guard alarm
    alarms.guardAlarm =
      isValidNumber(range) &&
      range < activeCollisionProfile.guard.range * METERS_PER_NM &&
      (activeCollisionProfile.guard.speed === 0 ||
        (isValidNumber(sog) &&
          sog > activeCollisionProfile.guard.speed / KNOTS_PER_M_PER_S));

    // collision alarm
    alarms.collisionAlarm =
      isValidNumber(cpa) &&
      cpa < activeCollisionProfile.danger.cpa * METERS_PER_NM &&
      isValidNumber(tcpa) &&
      tcpa > 0 &&
      tcpa < activeCollisionProfile.danger.tcpa * 60 &&
      (activeCollisionProfile.danger.speed === 0 ||
        (isValidNumber(sog) &&
          sog > activeCollisionProfile.danger.speed / KNOTS_PER_M_PER_S));

    // collision warning
    alarms.collisionWarning =
      isValidNumber(cpa) &&
      cpa < activeCollisionProfile.warning.cpa * METERS_PER_NM &&
      isValidNumber(tcpa) &&
      tcpa > 0 &&
      tcpa < activeCollisionProfile.warning.tcpa * 60 &&
      (activeCollisionProfile.warning.speed === 0 ||
        (isValidNumber(sog) &&
          sog > activeCollisionProfile.warning.speed / KNOTS_PER_M_PER_S));

    alarms.sartAlarm = !!mmsi && mmsi.startsWith("970");
    alarms.mobAlarm = !!mmsi && mmsi.startsWith("972");
    alarms.epirbAlarm = !!mmsi && mmsi.startsWith("974");

    const alarmList = [];

    if (alarms.guardAlarm) alarmList.push("guard");
    if (alarms.collisionAlarm || alarms.collisionWarning) alarmList.push("cpa");
    if (alarms.sartAlarm) alarmList.push("sart");
    if (alarms.mobAlarm) alarmList.push("mob");
    if (alarms.epirbAlarm) alarmList.push("epirb");

    if (alarmList.length > 0) {
      alarms.alarmType = alarmList.join(",");
    } else {
      alarms.alarmType = null;
    }

    // ============ BASIC ALARM PRIORITY ORDERING ============

    // alarm
    if (
      alarms.guardAlarm ||
      alarms.collisionAlarm ||
      alarms.sartAlarm ||
      alarms.mobAlarm ||
      alarms.epirbAlarm
    ) {
      alarms.alarmState = "danger";
      alarms.order = ORDER_DANGER;
    }
    // warning
    else if (alarms.collisionWarning) {
      alarms.alarmState = "warning";
      alarms.order = ORDER_WARNING;
    }
    // no alarm/warning - but has positive tcpa (closing)
    else if (isValidNumber(tcpa) && tcpa > 0) {
      alarms.alarmState = null;
      alarms.order = ORDER_CLOSING;
    }
    // no alarm/warning and moving away)
    else {
      alarms.alarmState = null;
      alarms.order = ORDER_OPENING;
    }

    // ============ ADJUSTMENTS TO ALARM PRIORITY ORDERING ============
    //
    // These only break ties within a band, so together they must stay well inside
    // one band width. They used to be unbounded: range alone added 1000 per NM and
    // so reached a whole band at 100 NM, which sorted an AIS-SART 150 NM out
    // (danger, 250000) below a routine collision warning 1 NM away (204999). It
    // also pushed a very distant target past the 999999 the symbol sort key is
    // derived from. Each term is now scaled into 0..TIEBREAK_MAX instead.

    // sort sooner tcpa vessels to top
    if (isValidNumber(tcpa) && tcpa > 0) {
      alarms.order += tiebreak(tcpa, TCPA_CEILING);
    }

    // sort closer cpa vessels to top
    if (isValidNumber(cpa) && cpa > 0) {
      alarms.order += tiebreak(cpa / METERS_PER_NM, CPA_CEILING_NM);
    }

    // TODO might be interesting to calculate rate of closure
    // high positive rate of closure decreases order

    // sort closer vessels to top, and vessels with no range at all to the bottom -
    // strictly behind even the most distant known range
    if (isValidNumber(range) && range > 0) {
      alarms.order += tiebreak(range / METERS_PER_NM, RANGE_CEILING_NM);
    } else if (!isValidNumber(range)) {
      alarms.order += TIEBREAK_MAX + 1;
    }
  } catch (err: unknown) {
    console.error("error in evaluateAlarms", err);
  }

  // console.log({ alarms });
  return alarms;
}

export function isValidNumber(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

export function isValidLatLng(lat: unknown, lng: unknown): boolean {
  return (
    isValidNumber(lng) &&
    isValidNumber(lat) &&
    lng >= -180 &&
    lng <= 180 &&
    lat >= -90 &&
    lat <= 90
  );
}
