// pure functions - range, bearing, cpa, tcpa

import destination from "@turf/destination";
import { KNOTS_PER_M_PER_S, METERS_PER_NM, R } from "./constants";
import {
  COURSE_PROJECTION_MINUTES,
  LOST_VESSEL_WARNING_AGE,
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

export function calcAlarms(
  activeCollisionProfile: CollisionProfile,
  range: number | undefined,
  sog: number | null,
  cpa: number | undefined,
  tcpa: number | undefined,
  mmsi: string,
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

    alarms.sartAlarm = mmsi.startsWith("970");
    alarms.mobAlarm = mmsi.startsWith("972");
    alarms.epirbAlarm = mmsi.startsWith("974");

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
      alarms.order = 100000;
    }
    // warning
    else if (alarms.collisionWarning) {
      alarms.alarmState = "warning";
      alarms.order = 200000;
    }
    // no alarm/warning - but has positive tcpa (closing)
    else if (isValidNumber(tcpa) && tcpa > 0) {
      alarms.alarmState = null;
      alarms.order = 300000;
    }
    // no alarm/warning and moving away)
    else {
      alarms.alarmState = null;
      alarms.order = 400000;
    }

    // ============ ADJUSTMENTS TO ALARM PRIORITY ORDERING ============

    // sort sooner tcpa vessels to top
    if (isValidNumber(tcpa) && tcpa > 0) {
      // tcpa of 0 seconds increases order by 0
      // tcpa of 300 seconds (5 mins) increases order by 1000
      // tcpa of 3600 seconds (1 hour) increases order by 12000
      const factor = 3.333; // 1000 / 300;
      // weight (points/s) * tcpa (s)
      alarms.order += factor * tcpa;
    }

    // sort closer cpa vessels to top
    if (isValidNumber(cpa) && cpa > 0) {
      // cpa of 0 nm increases order by 0
      // cpa of 1 nm increases order by 1000
      // cpa of 5 nm increases order by 5000
      // cpa of 10 nm increases order by 10000
      const factor = 1000; // 1000 / 1;
      alarms.order += (factor * cpa) / METERS_PER_NM;
    }

    // sort closer vessels to top
    if (isValidNumber(range) && range > 0) {
      // range of 0 nm increases order by 0
      // range of 1 nm increases order by 1000
      // range of 5 nm increases order by 5000
      // range of 10 nm increases order by 10000
      const factor = 1000; // 1000/1
      alarms.order += (factor * range) / METERS_PER_NM;
    }

    // TODO might be interesting to calculate rate of closure
    // high positive rate of closure decreases order

    // sort vessels with no range to bottom
    if (!isValidNumber(range)) {
      alarms.order += 99999;
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
