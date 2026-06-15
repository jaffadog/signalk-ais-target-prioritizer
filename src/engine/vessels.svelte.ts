// reactive state objects:
export const vessels = $state<Record<string, Vessel>>({});
export const vesselsState = $state<{
  myVesselMmsi: string | null;
  selectedVesselMmsi: string | null;
}>({
  myVesselMmsi: null,
  selectedVesselMmsi: null,
});

// ==============================
// Vessel factory
// ==============================
export interface Vessel {
  // raw properties from signal-k:
  mmsi: string;
  context: string;
  name: string;
  callsign: string | null;
  imo: string | null;
  sog: number | null;
  cog: number | null;
  hdg: number | null;
  rot: number | null;
  specialManeuver: string | null;
  magvar: number | null;
  latitude: number | null;
  longitude: number | null;
  lastSeenDate: Date | null;
  typeId: number | null;
  type: string;
  aisClass: string;
  status: string;
  length: number | null;
  beam: number | null;
  draft: number | null;
  destination: string;
  eta: string;
  isVirtual: number;
  isOffPosition: number;

  // augmented:
  alarmIsMuted: boolean;

  // derived:
  range: number | null;
  bearing: number | null;
  cpa: number | null;
  tcpa: number | null;
  cpaLocation: [number, number] | null;
  predictedLocation: [number, number] | null;
  lastSeenSecondsAgo: number | null;
  isLost: boolean;
  isValid: boolean;
  alarmType: string | null;
  alarmState: string | null;
  order: number;
}

export function createVessel(mmsi: string, context: string): Vessel {
  return {
    // raw properties from signal-k:
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

    // augmented:
    alarmIsMuted: false,

    // derived:
    range: null,
    bearing: null,
    cpa: null,
    tcpa: null,
    cpaLocation: null,
    predictedLocation: null,
    lastSeenSecondsAgo: null,
    isLost: false,
    isValid: true,
    alarmType: null,
    alarmState: null,
    order: 0,
  };
}

export function deleteVessel(mmsi: string) {
  delete vessels[mmsi];
}

export function deleteAllVessels() {
  for (const mmsi in vessels) deleteVessel(mmsi);
}
