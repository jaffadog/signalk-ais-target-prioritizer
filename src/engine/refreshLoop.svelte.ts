// setInterval - runs calcs, updates vessels

import {
  AGE_OUT_OLD_TARGETS,
  DATA_REFRESH_INTERVAL,
  TARGET_MAX_AGE,
} from "./constants";
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
import { deleteVessel, vessels, vesselsState } from "./vessels.svelte";
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

let timeoutId: ReturnType<typeof setTimeout> | undefined;

export function start() {
  console.log("start updateVesselsLoop");
  updateVesselsLoop();
}

export function stop() {
  if (!timeoutId) return;
  clearTimeout(timeoutId);
  timeoutId = undefined;
}

function updateVesselsLoop() {
  updateVessels();
  timeoutId = setTimeout(updateVesselsLoop, DATA_REFRESH_INTERVAL);
}

export function updateVessels() {
  flushPendingUpdates();

  if (!myVessel) {
    console.warn("no data for myVessel", { myVessel });
    return;
  }

  const myVelocity = calcVelocity(myVessel);

  for (const [mmsi, vessel] of Object.entries(vessels)) {
    // calculated from raw data:
    const projection = calcProjection(vessel, myVessel);
    const velocity = calcVelocity(vessel);
    const predictedLocation = calcPredictedLocation(vessel);
    const lastSeenSecondsAgo = calcLastSeenSecondsAgo(vessel);
    const isValid = calcIsValid(vessel);
    const cpaLocation =
      selectedVessel &&
      selectedVessel.tcpa !== undefined &&
      [vesselsState.myVesselMmsi, vesselsState.selectedVesselMmsi].includes(
        mmsi,
      )
        ? calcCpaLocation(vessel, selectedVessel.tcpa)
        : undefined;

    vessel.cpaLocation = cpaLocation;
    vessel.predictedLocation = predictedLocation;
    vessel.lastSeenSecondsAgo = lastSeenSecondsAgo;
    vessel.isValid = isValid;

    // calculated from derived data:
    if (vessel.mmsi !== vesselsState.myVesselMmsi) {
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
        calcAlarms(
          getActiveCollisionProfile(),
          range,
          vessel.sog,
          cpa,
          tcpa,
          mmsi,
        ) ?? {};

      vessel.range = range;
      vessel.bearing = bearing;
      vessel.cpa = cpa;
      vessel.tcpa = tcpa;
      vessel.isLost = isLost;
      vessel.alarmType = alarmType;
      vessel.alarmState = alarmState;
      vessel.order = order;

      if (
        AGE_OUT_OLD_TARGETS &&
        vessel.lastSeenSecondsAgo !== undefined &&
        vessel.lastSeenSecondsAgo > TARGET_MAX_AGE
      ) {
        deleteVessel(vessel);
      }
    }
  } // end loop
}
