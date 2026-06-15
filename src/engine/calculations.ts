// pure functions - range, bearing, cpa, tcpa

import destination from "@turf/destination";
import { KNOTS_PER_M_PER_S, METERS_PER_NM, R } from "./constants";
import {
  COURSE_PROJECTION_MINUTES,
  LOST_VESSEL_WARNING_AGE,
} from "./constants";
import type { Vessel } from "./vessels.svelte";
import type { TwoDim } from "./calculation.types";
import type { CollisionProfile } from "./collisionProfiles.svelte";

export function toRad(d: number) {
  return (d * Math.PI) / 180;
}

export function toDeg(r: number) {
  return (r * 180) / Math.PI;
}

// equirectangular projection
export function calcProjection(t: Vessel, m: Vessel): TwoDim | undefined {
  if (
    t.latitude === null ||
    t.longitude === null ||
    m.latitude === null ||
    m.longitude === null
  )
    return;
  const x = toRad(t.longitude - m.longitude) * Math.cos(toRad(m.latitude)) * R;
  const y = toRad(t.latitude - m.latitude) * R;
  return { x, y };
}

export function calcRange(p: TwoDim) {
  if (!p) return null;
  return Math.sqrt(p.x * p.x + p.y * p.y);
}

export function calcBearing(p: TwoDim) {
  if (!p) return null;
  return (toDeg(Math.atan2(p.x, p.y)) + 360) % 360;
}

// sog in m/s, cog in radians
export function calcVelocity(t: Vessel): TwoDim {
  // if we dont have sog or cog, assume the vessel is not moving and proceed with cpa calc
  if (t.sog === null || t.cog === null) return { x: 0, y: 0 };

  return {
    x: t.sog * Math.sin(t.cog),
    y: t.sog * Math.cos(t.cog),
  };
}

export function calcCpa(
  projection: TwoDim,
  velocity: TwoDim,
  myVelocity: TwoDim,
) {
  if (!projection || !velocity || !myVelocity) return;

  const v = {
    x: velocity.x - myVelocity.x,
    y: velocity.y - myVelocity.y,
  };

  const v2 = v.x * v.x + v.y * v.y;
  if (v2 < 0.0001) return null;

  const t = -(projection.x * v.x + projection.y * v.y) / v2;
  // if cpa was in the past:
  // could set it to 0, or cancel the cpa calc, or leave it as is
  if (t < 0) return null;

  const cx = projection.x + v.x * t;
  const cy = projection.y + v.y * t;

  return {
    tcpa: t,
    cpa: Math.sqrt(cx * cx + cy * cy),
  };
}

export function calcCpaLocation(t: Vessel, tcpa: number) {
  if (
    t.latitude === null ||
    t.longitude === null ||
    t.cog === null ||
    t.sog === null ||
    tcpa === null
  )
    return;

  const end = destination(
    [t.longitude, t.latitude],
    t.sog * tcpa,
    toDeg(t.cog),
    {
      units: "meters",
    },
  );

  return end.geometry.coordinates;
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

export function calcPredictedLocation(v: Vessel) {
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

  return end.geometry.coordinates;
}

export function calcLastSeenSecondsAgo(v: Vessel) {
  if (!v.lastSeenDate) return;
  const diff = Math.round(
    (new Date().getTime() - new Date(v.lastSeenDate).getTime()) / 1000,
  );
  return diff > 0 ? diff : 0;
}

export function calcIsLost(lastSeenSecondsAgo: number) {
  return (
    !Number.isFinite(lastSeenSecondsAgo) ||
    lastSeenSecondsAgo > LOST_VESSEL_WARNING_AGE
  );
}

export function calcIsValid(v: Vessel) {
  // FIXME add filter for aged out targets
  return Number.isFinite(v.latitude) && Number.isFinite(v.longitude);
}

export function calcAlarms(
  activeCollisionProfile: CollisionProfile,
  range: number,
  sog: number,
  cpa: number,
  tcpa: number,
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
      Number.isFinite(range) &&
      range < activeCollisionProfile.guard.range * METERS_PER_NM &&
      (activeCollisionProfile.guard.speed === 0 ||
        (Number.isFinite(sog) &&
          sog > activeCollisionProfile.guard.speed / KNOTS_PER_M_PER_S));

    // collision alarm
    alarms.collisionAlarm =
      Number.isFinite(cpa) &&
      cpa < activeCollisionProfile.danger.cpa * METERS_PER_NM &&
      Number.isFinite(tcpa) &&
      tcpa > 0 &&
      tcpa < activeCollisionProfile.danger.tcpa &&
      (activeCollisionProfile.danger.speed === 0 ||
        (Number.isFinite(sog) &&
          sog > activeCollisionProfile.danger.speed / KNOTS_PER_M_PER_S));

    // collision warning
    alarms.collisionWarning =
      Number.isFinite(cpa) &&
      cpa < activeCollisionProfile.warning.cpa * METERS_PER_NM &&
      Number.isFinite(tcpa) &&
      tcpa > 0 &&
      tcpa < activeCollisionProfile.warning.tcpa &&
      (activeCollisionProfile.warning.speed === 0 ||
        (Number.isFinite(sog) &&
          sog > activeCollisionProfile.warning.speed / KNOTS_PER_M_PER_S));

    alarms.sartAlarm = mmsi.startsWith("970");
    alarms.mobAlarm = mmsi.startsWith("972");
    alarms.epirbAlarm = mmsi.startsWith("974");

    //FIXME - need to clean up this order logic.
    // vessels with alarm status must be at the top
    // vessels with negative tcpa are very low priority

    // alarm
    if (
      alarms.guardAlarm ||
      alarms.collisionAlarm ||
      alarms.sartAlarm ||
      alarms.mobAlarm ||
      alarms.epirbAlarm
    ) {
      alarms.alarmState = "danger";
      alarms.order = 10000;
    }
    // warning
    else if (alarms.collisionWarning) {
      alarms.alarmState = "warning";
      alarms.order = 20000;
    }
    // no alarm/warning - but has positive tcpa (closing)
    else if (Number.isFinite(tcpa) && tcpa > 0) {
      alarms.alarmState = null;
      alarms.order = 30000;
    }
    // no alarm/warning and moving away)
    else {
      alarms.alarmState = null;
      alarms.order = 40000;
    }

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

    // sort sooner tcpa vessels to top
    if (Number.isFinite(tcpa) && tcpa > 0) {
      // sort vessels with any tcpa above vessels that dont have a tcpa
      alarms.order -= 1000;
      // tcpa of 0 seconds reduces order by 1000 (this is an arbitrary weighting)
      // tcpa of 60 minutes reduces order by 0
      const weight = 1000;
      alarms.order -= Math.max(0, Math.round(weight - (weight * tcpa) / 3600));
    }

    // sort closer cpa vessels to top
    if (Number.isFinite(cpa) && cpa > 0) {
      // cpa of 0 nm reduces order by 2000 (this is an arbitrary weighting)
      // cpa of 5 nm reduces order by 0
      const weight = 2000;
      alarms.order -= Math.max(
        0,
        Math.round(weight - (weight * cpa) / 5 / METERS_PER_NM),
      );
    }

    // sort closer vessels to top
    if (Number.isFinite(range) && range > 0) {
      // range of 0 nm increases order by 0
      // range of 5 nm increases order by 500
      alarms.order += Math.round((100 * range) / METERS_PER_NM);
    }

    // FIXME might be interesting to calculate rate of closure
    // high positive rate of close decreases order

    // sort vessels with no range to bottom
    if (!Number.isFinite(range)) {
      alarms.order += 99999;
    }
  } catch (err: unknown) {
    console.error("error in evaluateAlarms", err);
  }

  // console.log({ alarms });
  return alarms;
}
