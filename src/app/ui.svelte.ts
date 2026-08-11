import type { ThemeMode } from "../types";
import { getStored } from "./utils/storage";

const THEME_MODES: readonly string[] = ["light", "dark", "system"];

// an unrecognized stored value would otherwise pass the cast and match no theme
// button, while silently resolving to light mode
function storedThemeMode(): ThemeMode {
  const stored = getStored("theme");
  return THEME_MODES.includes(stored as string)
    ? (stored as ThemeMode)
    : "system";
}

export const ui = $state({
  documentVisibilityState: undefined,
  width: undefined,
  noSleep: false,
  themeMode: storedThemeMode(),
  darkMode: false,
  loading: {
    visible: true,
  },
  app: {
    visible: false,
  },
  vesselProperties: {
    visible: false,
  },
  vesselTable: {
    visible: false,
  },
  settings: {
    visible: false,
  },
  editProfiles: {
    visible: false,
  },
  notification: {
    visible: false,
  },
  alarms: {
    visible: false,
  },
  layersMenu: {
    visible: false,
  },
});

export function resolveIsDark(mode: ThemeMode): boolean {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  return mode === "dark";
}
