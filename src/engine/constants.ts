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
export const NO_GPS_FIX_WARNING = 60; // seconds

export const COURSE_PROJECTION_MINUTES = 10; // 10 minutes
export const LOST_VESSEL_WARNING_AGE = 10 * 60; // 10 minutes
export const LOST_VESSEL_DELETE_AGE = 30 * 60; // 30 minutes
export const SHOW_ALARMS_INTERVAL = 60_000; // every 60 seconds
export const WARM_UP_TIME = 5_000; // 5 seconds

export const STALE_VESSEL_TTL_MS = 30 * 60 * 1000;
export const STALE_VESSEL_SWEEP_MS = 60_000;

export const DATA_REFRESH_INTERVAL = 1_000; // 1 second

export const CHECK_ONLINE_INTERVAL = 30_000; // every 30 seconds
export const CHECK_ONLINE_TIMEOUT = 3_000; // 3 seconds
export const PROBE_URL = "https://www.google.com/generate_204";

export const DEFAULT_ZOOM = 10;

// how often we re-read the tracks api. the tracks plugin only adds a point per
// its own configured resolution (60s by default), so polling faster than this
// just re-fetches identical data.
export const TRACKS_REFRESH_INTERVAL = 30_000; // every 30 seconds

// used when the tracks plugin config cannot be read - matches the plugin default
export const DEFAULT_TRACK_RESOLUTION = 60_000; // milliseconds per track point

// time-spaced dots crowd into a solid line as you zoom out, so we drop every Nth
// dot to hold a roughly constant on-screen spacing. N is derived from a single
// reference speed rather than each vessel's own speed, so the time step stays
// identical across all targets - only the interval widens, by a whole multiple.
export const TRAIL_DOT_REFERENCE_SPEED = 10; // knots
export const TRAIL_DOT_SPACING = 25; // target pixels between dots
export const TRAIL_DOT_RADIUS = 2; // pixels

// how much past track to draw. the tracks plugin is shared across signal k, so its
// retention is set for whatever else consumes it (24h at 60s x 1440, say) - that is
// far more than a collision avoidance plot wants, so we window it here.
export const TRAIL_LENGTH = 60; // minutes of past positions to show

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
