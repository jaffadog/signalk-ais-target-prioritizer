import type { Context } from "@signalk/server-api";
import type { Vessel } from "../types";

// reactive state objects:
export const vessels = $state<Record<string, Vessel>>({});
export const vesselsState = $state<{
  myVesselMmsi: string | null;
  selectedVesselMmsi: string | null;
}>({
  myVesselMmsi: null,
  selectedVesselMmsi: null,
});

export function createVessel(mmsi: string, context: Context): Vessel {
  return {
    // raw properties from signal k:
    mmsi,
    context,
    name: "",
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
    type: "---",
    aisClass: "A",
    status: "---",
    length: null,
    beam: null,
    draft: null,
    destination: "---",
    eta: "---",
    isVirtual: 0,
    isOffPosition: 0,

    // default values for optional local properties and derived:
    alarmIsMuted: false,
    isLost: false,
    isValid: false,
  };
}

export function deleteVessel(mmsi: string) {
  delete vessels[mmsi];
}

export function deleteAllVessels() {
  for (const mmsi in vessels) deleteVessel(mmsi);
}
