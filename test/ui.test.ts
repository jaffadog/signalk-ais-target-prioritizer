import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { resolveIsDark, ui } from "../src/app/ui.svelte";
import { name as PLUGIN_ID } from "../package.json";

function setPrefersDark(matches: boolean) {
  globalThis.window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

// re-import the module with a given stored theme, to exercise the initialiser
async function themeModeFor(stored: string | null) {
  const key = `${PLUGIN_ID}.theme`;
  if (stored === null) localStorage.removeItem(key);
  else localStorage.setItem(key, stored);

  vi.resetModules();
  const fresh = await import("../src/app/ui.svelte");
  return fresh.ui.themeMode;
}

beforeEach(() => {
  setPrefersDark(false);
});

afterEach(() => {
  localStorage.removeItem(`${PLUGIN_ID}.theme`);
  vi.resetModules();
});

describe("resolveIsDark", () => {
  it("takes an explicit choice at face value", () => {
    expect(resolveIsDark("dark")).toBe(true);
    expect(resolveIsDark("light")).toBe(false);
  });

  it("asks the browser when set to system", () => {
    setPrefersDark(true);
    expect(resolveIsDark("system")).toBe(true);

    setPrefersDark(false);
    expect(resolveIsDark("system")).toBe(false);
  });

  it("ignores the browser preference for an explicit choice", () => {
    setPrefersDark(true);
    expect(resolveIsDark("light")).toBe(false);
  });
});

describe("the stored theme mode", () => {
  it("uses a recognised stored value", async () => {
    for (const mode of ["light", "dark", "system"]) {
      expect(await themeModeFor(mode)).toBe(mode);
    }
  });

  it("defaults to system when nothing is stored", async () => {
    expect(await themeModeFor(null)).toBe("system");
  });

  // regression: the stored value used to be cast straight to ThemeMode with only
  // a null check, so any other string passed through, matched none of the three
  // theme buttons (leaving no mode indicated) and silently resolved to light
  it("falls back to system for a value it does not recognise", async () => {
    for (const junk of ["auto", "", "DARK", "sk:dark", "true", "0"]) {
      expect(await themeModeFor(junk), junk).toBe("system");
    }
  });

  it("still resolves to a usable theme after rejecting a junk value", async () => {
    setPrefersDark(true);
    const mode = await themeModeFor("nonsense");
    // system, and therefore dark here - not silently forced to light
    expect(resolveIsDark(mode)).toBe(true);
  });
});

describe("the ui state", () => {
  it("starts with the loading screen up and the app hidden", () => {
    expect(ui.loading.visible).toBe(true);
    expect(ui.app.visible).toBe(false);
  });

  it("starts with every dialog closed", () => {
    for (const panel of [
      "vesselProperties",
      "vesselTable",
      "settings",
      "editProfiles",
      "notification",
      "alarms",
      "layersMenu",
    ] as const) {
      expect(ui[panel].visible, panel).toBe(false);
    }
  });

  it("exposes each dialog as an independently settable flag", () => {
    ui.settings.visible = true;
    expect(ui.settings.visible).toBe(true);
    expect(ui.alarms.visible).toBe(false);
    ui.settings.visible = false;
  });
});
