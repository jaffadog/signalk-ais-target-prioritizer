import type { ThemeMode } from "../types";

export const ui = $state({
  visible: undefined,
  width: undefined,
  noSleep: false,
  themeMode: (localStorage.getItem("theme") as ThemeMode) ?? "system",
  darkMode: false,
  // darkMode: localStorage.getItem("theme") === "dark",
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
