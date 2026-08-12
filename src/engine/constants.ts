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

// used when the tracks plugin config cannot be read (a non-admin session cannot see it)
// - matches the plugin default. note this is a floor on the interval between points,
// not the interval itself, and installs set it anywhere from a second to minutes.
export const DEFAULT_TRACK_RESOLUTION = 60_000; // milliseconds per track point

// a target's past track is drawn as a polyline with a dotted texture, at one fixed
// spacing for every vessel.
//
// SN.1/Circ.243 asks for "dots, equally spaced by time", and plotting the api's own
// points looks like it delivers that - but it cannot. The api carries no timestamps, the
// plugin's resolution is only a floor, AIS reporting rates vary per ship, and reception
// is lossy, so the real interval is unknown, uneven, and different for every target.
// Dots on those points imply a cadence that is not real. A dash pattern is spaced in
// screen space instead: uniform at every zoom, for every target, and claiming nothing
// about time we cannot back up. The speed cue time-spaced dots would have given is
// already carried, better, by the course projection line, whose length scales with speed.
export const TRAIL_DOT_WIDTH = 3; // pixels - the dot diameter
export const TRAIL_DOT_SPACING = 9; // pixels between dot centres
export const TRAIL_OPACITY = 1;

// how much past track to draw. the tracks plugin is shared across signal k, so its
// retention is set for whatever else consumes it (24h at 60s x 1440, say) - that is
// far more than a collision avoidance plot wants, so we window it here.
export const TRAIL_LENGTH = 60; // minutes of past positions to show

// ---- priority sort key (see calcAlarms) ----
// targets drop into a band by severity, then sort within that band by the tie
// breakers below. the invariant is that every tie breaker is clamped so their sum
// can never reach a full band width - otherwise a merely distant target climbs into
// a band it does not belong in.
export const ORDER_BAND = 100_000;
export const ORDER_DANGER = 1 * ORDER_BAND;
export const ORDER_WARNING = 2 * ORDER_BAND;
export const ORDER_CLOSING = 3 * ORDER_BAND;
export const ORDER_OPENING = 4 * ORDER_BAND;

// the most any single tie breaker can contribute. the worst case is two of them
// plus the no-range penalty, which stays under two thirds of a band.
export const TIEBREAK_MAX = ORDER_BAND / 5;

// at or beyond these, values all score TIEBREAK_MAX - they are already far enough
// out that ordering between them does not matter. tcpa and cpa match the largest a
// collision profile can specify (60 min, 10 NM); the range ceiling is just a chosen
// horizon, since maximumTargetRange has no configured upper bound.
export const TCPA_CEILING = 60 * 60; // seconds
export const CPA_CEILING_NM = 10;
export const RANGE_CEILING_NM = 100;

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
