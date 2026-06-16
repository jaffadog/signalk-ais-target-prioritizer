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

const myVessel = $derived(vessels[vesselsState.myVesselMmsi]);
const selectedVessel = $derived(vessels[vesselsState.selectedVesselMmsi]);

let timeoutId;

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
      vesselsState.selectedVesselMmsi &&
      [vesselsState.myVesselMmsi, vesselsState.selectedVesselMmsi].includes(
        mmsi,
      )
        ? calcCpaLocation(v, selectedVessel.tcpa)
        : null;

    v.cpaLocation = cpaLocation;
    v.predictedLocation = predictedLocation;
    v.lastSeenSecondsAgo = lastSeenSecondsAgo;
    v.isValid = isValid;

    // calculated from derived data:
    if (v.mmsi !== vesselsState.myVesselMmsi) {
      const range = calcRange(projection);
      const bearing = calcBearing(projection);
      const { cpa = null, tcpa = null } =
        calcCpa(projection, velocity, myVelocity) ?? {};
      const isLost = calcIsLost(lastSeenSecondsAgo);
      const { alarmType, alarmState, order } =
        calcAlarms(
          getActiveCollisionProfile(),
          range,
          v.sog,
          cpa,
          tcpa,
          mmsi,
        ) ?? {};

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
