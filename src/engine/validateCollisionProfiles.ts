import type {
  CollisionProfiles,
  ProfileName,
} from "./collisionProfiles.svelte";

const RANGES = {
  cpa: { min: 0, max: 10 },
  tcpa: { min: 0, max: 60 },
  speed: { min: 0, max: 10 },
  range: { min: 0, max: 10 },
} as const;

const PROFILE_NAMES: ProfileName[] = [
  "anchor",
  "harbor",
  "coastal",
  "offshore",
];

function inRange(val: unknown, min: number, max: number): boolean {
  const isValid = typeof val === "number" && val >= min && val <= max;
  if (!isValid) console.warn(">>>>> invalid", val, min, max);
  return isValid;
}

function isValidThreshold(t: unknown): boolean {
  if (typeof t !== "object" || t === null) return false;
  const { cpa, tcpa, speed } = t as never;
  return (
    inRange(cpa, RANGES.cpa.min, RANGES.cpa.max) &&
    inRange(tcpa, RANGES.tcpa.min, RANGES.tcpa.max) &&
    inRange(speed, RANGES.speed.min, RANGES.speed.max)
  );
}

function isValidGuard(g: unknown): boolean {
  if (typeof g !== "object" || g === null) return false;
  const { range, speed } = g as never;
  return (
    inRange(range, RANGES.range.min, RANGES.range.max) &&
    inRange(speed, RANGES.speed.min, RANGES.speed.max)
  );
}

function isValidProfile(p: unknown): boolean {
  if (typeof p !== "object" || p === null) return false;
  const { warning, danger, guard } = p as never;
  return (
    isValidThreshold(warning) && isValidThreshold(danger) && isValidGuard(guard)
  );
}

export function isValidCollisionProfiles(
  data: unknown,
): data is CollisionProfiles {
  if (typeof data !== "object" || data === null) return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;
  return (
    PROFILE_NAMES.includes(d.current) &&
    PROFILE_NAMES.every((name) => isValidProfile(d[name]))
  );
}
