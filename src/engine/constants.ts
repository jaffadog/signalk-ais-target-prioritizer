export const METERS_PER_NM = 1852;
export const KNOTS_PER_M_PER_S = 1.94384;
export const R = 6371000; // meters

//plugin options defaults
export const DEFAULT_UPDATE_INTERVAL_DELAY = 3; // seconds
export const DEFAULT_MAXIMUM_TARGET_RANGE = 50; // NM
export const DEFAULT_ENABLE_DATA_PUBLISHING = true;
export const DEFAULT_ENABLE_ALARM_PUBLISHING = true;

export const AGE_OUT_OLD_TARGETS = true;
export const TARGET_MAX_AGE = 30 * 60; // max age in seconds - 30 minutes
export const NO_GPS_FIX_WARNING = 30; // seconds

export const COURSE_PROJECTION_MINUTES = 10; // 10 minutes
export const LOST_VESSEL_WARNING_AGE = 10 * 60; // 10 minutes
export const LOST_VESSEL_DELETE_AGE = 30 * 60; // 30 minutes
export const SHOW_ALARMS_INTERVAL = 60_000; // every 60 seconds
export const WARM_UP_TIME = 5_000; // 5 seconds

export const STALE_VESSEL_TTL_MS = 30 * 60 * 1000;
export const STALE_VESSEL_SWEEP_MS = 60_000;

export const DATA_REFRESH_INTERVAL = 1_000; // 1 second

export const CHECK_ONLINE_INTERVAL = 30_000; // every 30 seconds

export const DEFAULT_BASEMAP = "street";
export const DEFAULT_OFFLINE_BASEMAP = "empty";

export const COLOR_MAP = {
  gray: "#8a8a8a",
  orange: "#f97316",
  red: "#ef4444",
  blue: "#1f78ff",
};

export const COLORS = Object.keys(COLOR_MAP) as (keyof typeof COLOR_MAP)[];

export const AlarmState = Object.freeze({
  SAFE: "safe",
  WARNING: "warning",
  DANGER: "danger",
});
