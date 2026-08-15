// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/svelte";

import Settings from "../src/app/components/Settings.svelte";
import { mapState } from "../src/app/map.svelte";
import { ui } from "../src/app/ui.svelte";
import { collisionProfiles } from "../src/engine/collisionProfiles.svelte";

const pushMuteAllAlarms = vi.fn();
const saveCollisionProfiles = vi.fn();

vi.mock("../src/app/utils/api", () => ({
  pushMuteAllAlarms: (...a: unknown[]) => pushMuteAllAlarms(...a),
  saveCollisionProfiles: (...a: unknown[]) => saveCollisionProfiles(...a),
  getTrackResolution: vi.fn(),
  getTracks: vi.fn(),
  getCharts: vi.fn(),
}));

vi.mock("../src/app/utils/toaster", () => ({
  toaster: {
    success: vi.fn(),
    error: vi.fn(),
    create: vi.fn(),
    remove: vi.fn(),
  },
}));

// Settings re-checks the font pack on mount
vi.mock("../src/app/map.svelte", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/app/map.svelte")>();
  return {
    ...actual,
    checkFontsAvailable: vi.fn(),
    handleDownloadFonts: vi.fn(),
    handleRemoveFonts: vi.fn(),
  };
});

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  saveCollisionProfiles.mockResolvedValue({ success: true });
  pushMuteAllAlarms.mockReset();
  ui.settings.visible = true;
  ui.noSleep = false;
  mapState.trails = true;
  mapState.protomapsFontsAvailable = false;
  collisionProfiles.current = "offshore";
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const trailsSwitch = () =>
  screen.getByText("Show Vessel Tracks").closest("label") ??
  screen.getByText("Show Vessel Tracks").parentElement!;

describe("Settings", () => {
  it("shows the active profile and the other choices", () => {
    render(Settings);

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("offshore");
    for (const name of ["Anchored", "Harbor", "Coastal", "Offshore"]) {
      expect(screen.getByText(name)).toBeTruthy();
    }
  });

  it("switches the active profile", () => {
    render(Settings);

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    select.value = "harbor";
    select.dispatchEvent(new Event("change", { bubbles: true }));

    expect(collisionProfiles.current).toBe("harbor");
  });

  it("opens Edit Profiles and closes itself", () => {
    render(Settings);

    screen.getByRole("button", { name: /edit profiles/i }).click();

    expect(ui.editProfiles.visible).toBe(true);
    expect(ui.settings.visible).toBe(false);
  });

  it("mutes everything and tells the server from Mute All Alarms", () => {
    render(Settings);

    screen.getByRole("button", { name: /mute all alarms/i }).click();

    expect(pushMuteAllAlarms).toHaveBeenCalledTimes(1);
    expect(ui.settings.visible).toBe(false);
  });

  describe("the vessel trails toggle", () => {
    it("is offered, and reflects that trails are on by default", () => {
      render(Settings);

      expect(screen.getByText("Show Vessel Tracks")).toBeTruthy();
      expect(trailsSwitch().getAttribute("data-state")).toBe("checked");
    });

    it("shows unchecked when trails are off", () => {
      mapState.trails = false;
      render(Settings);

      expect(trailsSwitch().getAttribute("data-state")).toBe("unchecked");
    });

    it("turns trails off when switched off", () => {
      render(Settings);

      (trailsSwitch().querySelector("input") as HTMLInputElement).click();

      expect(mapState.trails).toBe(false);
    });

    it("turns trails back on", () => {
      mapState.trails = false;
      render(Settings);

      (trailsSwitch().querySelector("input") as HTMLInputElement).click();

      expect(mapState.trails).toBe(true);
    });
  });

  describe("the map label pack", () => {
    it("offers the download when the fonts are absent", () => {
      mapState.protomapsFontsAvailable = false;
      render(Settings);

      expect(screen.getByText("Map Labels")).toBeTruthy();
      expect(screen.getByRole("button", { name: /download/i })).toBeTruthy();
    });

    it("offers removal once they are installed", () => {
      mapState.protomapsFontsAvailable = true;
      render(Settings);

      expect(screen.getByText(/map labels installed/i)).toBeTruthy();
      expect(screen.getByRole("button", { name: /remove/i })).toBeTruthy();
    });

    // this branch was unreachable until protomapsFontsAvailable was widened to
    // boolean | undefined and cleared for the duration of the check
    it("reports that it is still checking while the answer is unknown", () => {
      mapState.protomapsFontsAvailable = undefined;
      render(Settings);

      expect(screen.getByText(/checking map labels/i)).toBeTruthy();
    });
  });
});
