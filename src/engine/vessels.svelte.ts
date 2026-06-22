import type { Context } from "@signalk/server-api";
import type { Vessel } from "../types";

// reactive state objects:
export const vessels = $state<Record<Context, Vessel>>({});
export const vesselsState = $state<{
  myVesselContext: Context | null;
  selectedVesselContext: Context | null;
}>({
  myVesselContext: null,
  selectedVesselContext: null,
});

export function createVessel(context: Context): Vessel {
  return {
    // raw properties from signal k:
    context,
    mmsi: null,
    name: null,
    callsign: null,
    imo: null,
    sog: null,
    cog: null,
    hdg: null,
    rot: null,
    specialManeuver: null,
    magvar: null,
    latitude: null,
    longitude: null,
    lastSeenDate: null,
    typeId: null,
    type: null,
    aisClass: null,
    status: null,
    length: null,
    beam: null,
    draft: null,
    destination: null,
    eta: null,
    isVirtual: null,
    isOffPosition: null,

    // default values for optional local properties and derived:
    alarmIsMuted: false,
    isLost: false,
    isValid: false,
  };
}

export function deleteVessel(vessel: Vessel) {
  console.log(
    "ageing out vessel",
    vessel.context,
    vessel.mmsi,
    vessel.name,
    vessel.lastSeenSecondsAgo,
  );
  delete vessels[vessel.context];
}

export function deleteAllVessels() {
  for (const vessel of Object.values(vessels)) {
    deleteVessel(vessel);
  }
}
