// global types and interfaces

export type Vector2D = { x: number; y: number };
export interface CollisionProfile {
  warning: {
    cpa: number;
    tcpa: number;
    speed: number;
  };
  danger: {
    cpa: number;
    tcpa: number;
    speed: number;
  };
  guard: {
    range: number;
    speed: number;
  };
}

export type ProfileName = "anchor" | "harbor" | "coastal" | "offshore";

export interface CollisionProfiles {
  current: ProfileName;
  anchor: CollisionProfile;
  harbor: CollisionProfile;
  coastal: CollisionProfile;
  offshore: CollisionProfile;
} // ==============================
// Vessel factory
// ==============================

export interface Vessel {
  // raw properties from signal k:
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
  range?: number;
  bearing?: number;
  cpa?: number;
  tcpa?: number;
  cpaLocation?: Position;
  predictedLocation?: Position;
  lastSeenSecondsAgo?: number;
  isLost?: boolean;
  isValid?: boolean;
  alarmType?: string | null;
  alarmState?: string | null;
  order?: number;
}
export interface AlarmsState {
  lastAlarmTime: number | null;
}

export interface CustomButtonControlOptions {
  title?: string;
  svgIcon: string;
  svgClass?: string;
  rotateWithBearing?: boolean;
  onClick?: (map: maplibregl.Map) => void;
}

export type Position = [number, number];
