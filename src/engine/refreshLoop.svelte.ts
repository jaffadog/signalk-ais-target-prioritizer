// setInterval - runs calcs, updates vessels

import { DATA_REFRESH_INTERVAL } from "./constants";
import {
  calcBearing,
  calcCpa,
  calcRange,
  calcProjection,
  calcVelocity,
  calcCpaLocation,
  calcPredictedLocation,
  calcLastSeenSecondsAgo,
  calcIsLost,
  calcIsValid,
  calcAlarms,
} from "./calculations";
import { vessels, vesselsState } from "./vessels.svelte";
import { flushPendingUpdates } from "./ingestion.svelte";
import { getActiveCollisionProfile } from "./collisionProfiles.svelte";
import type { Vessel } from "../types";

const myVessel: Vessel | null = $derived(
  vesselsState.myVesselMmsi ? vessels[vesselsState.myVesselMmsi] : null,
);
const selectedVessel: Vessel | null = $derived(
  vesselsState.selectedVesselMmsi
    ? vessels[vesselsState.selectedVesselMmsi]
    : null,
);

let timeoutId: ReturnType<typeof setTimeout> | null;

export function start() {
  console.log("start updateVesselsLoop");
  updateVesselsLoop();
}

export function stop() {
  if (!timeoutId) return;
  clearTimeout(timeoutId);
  timeoutId = null;
}

function updateVesselsLoop() {
  updateVessels();
  timeoutId = setTimeout(updateVesselsLoop, DATA_REFRESH_INTERVAL);
}

export function updateVessels() {
  flushPendingUpdates();

  if (!myVessel) {
    // FIXME we could do a toast for this... no my vessel... no gps... outdated gps...
    console.warn("no data for myVessel", { myVessel });
    return;
  }

  const myVelocity = calcVelocity(myVessel);

  for (const [mmsi, v] of Object.entries(vessels)) {
    // calculated from raw data:
    const projection = calcProjection(v, myVessel);
    const velocity = calcVelocity(v);
    const predictedLocation = calcPredictedLocation(v);
    const lastSeenSecondsAgo = calcLastSeenSecondsAgo(v);
    const isValid = calcIsValid(v);
    const cpaLocation =
      selectedVessel &&
      selectedVessel.tcpa !== undefined &&
      [vesselsState.myVesselMmsi, vesselsState.selectedVesselMmsi].includes(
        mmsi,
      )
        ? calcCpaLocation(v, selectedVessel.tcpa)
        : undefined;

    v.cpaLocation = cpaLocation;
    v.predictedLocation = predictedLocation;
    v.lastSeenSecondsAgo = lastSeenSecondsAgo;
    v.isValid = isValid;

    // calculated from derived data:
    if (v.mmsi !== vesselsState.myVesselMmsi) {
      const range = projection ? calcRange(projection) : undefined;
      const bearing = projection ? calcBearing(projection) : undefined;
      const { cpa = undefined, tcpa = undefined } = projection
        ? (calcCpa(projection, velocity, myVelocity) ?? {})
        : {};
      const isLost =
        lastSeenSecondsAgo !== undefined
          ? calcIsLost(lastSeenSecondsAgo)
          : false;
      const { alarmType, alarmState, order } =
        range !== undefined &&
        v.sog !== null &&
        cpa !== undefined &&
        tcpa !== undefined
          ? (calcAlarms(
              getActiveCollisionProfile(),
              range,
              v.sog,
              cpa,
              tcpa,
              mmsi,
            ) ?? {})
          : {};

      v.range = range;
      v.bearing = bearing;
      v.cpa = cpa;
      v.tcpa = tcpa;
      v.isLost = isLost;
      v.alarmType = alarmType;
      v.alarmState = alarmState;
      v.order = order;
    }
  }
}
