// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/svelte";

import EditProfiles from "../src/app/components/EditProfiles.svelte";
import {
  collisionProfiles,
  resetCollisionProfiles,
  setCollisionProfiles,
} from "../src/engine/collisionProfiles.svelte";
import { ui } from "../src/app/ui.svelte";

const saveCollisionProfiles = vi.fn();
vi.mock("../src/app/utils/api", () => ({
  saveCollisionProfiles: (...a: unknown[]) => saveCollisionProfiles(...a),
}));

vi.mock("../src/app/utils/toaster", () => ({
  toaster: {
    success: vi.fn(),
    error: vi.fn(),
    create: vi.fn(),
    remove: vi.fn(),
  },
}));

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  saveCollisionProfiles.mockResolvedValue({ success: true });
  resetCollisionProfiles();
  ui.editProfiles.visible = true;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("EditProfiles", () => {
  it("offers a tab per alarm kind", () => {
    render(EditProfiles);

    expect(screen.getByText(/collision warning/i)).toBeTruthy();
    expect(screen.getByText(/collision alarm/i)).toBeTruthy();
    expect(screen.getByText(/guard alarm/i)).toBeTruthy();
  });

  it("lets the profile be switched", () => {
    render(EditProfiles);

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    select.value = "harbor";
    select.dispatchEvent(new Event("change", { bubbles: true }));

    expect(collisionProfiles.current).toBe("harbor");
  });

  // this is the button that was doing nothing: the store was initialised with the
  // defaults object itself, so editing the store edited the defaults too and there
  // was nothing original left to restore
  describe("Restore Defaults", () => {
    it("puts an edited threshold back to the shipped value", () => {
      render(EditProfiles);
      collisionProfiles.offshore.warning.cpa = 9.5;

      screen.getByRole("button", { name: /restore defaults/i }).click();

      expect(collisionProfiles.offshore.warning.cpa).toBe(4);
    });

    it("restores after settings have been loaded from the server", () => {
      // what App.svelte does at startup, which is what corrupted the defaults.
      // built literally rather than cloned - collisionProfiles is a $state proxy,
      // which structuredClone refuses in jsdom.
      const loaded = {
        warning: { cpa: 8, tcpa: 50, speed: 3 },
        danger: { cpa: 7, tcpa: 40, speed: 2 },
        guard: { range: 6, speed: 1 },
      };
      setCollisionProfiles({
        current: "harbor",
        anchor: loaded,
        harbor: loaded,
        coastal: loaded,
        offshore: loaded,
      });

      render(EditProfiles);
      screen.getByRole("button", { name: /restore defaults/i }).click();

      expect(collisionProfiles.current).toBe("offshore");
      expect(collisionProfiles.offshore.warning.cpa).toBe(4);
      expect(collisionProfiles.offshore.danger.tcpa).toBe(15);
      expect(collisionProfiles.offshore.guard.range).toBe(0);
    });

    it("restores every profile, not only the active one", () => {
      render(EditProfiles);
      collisionProfiles.harbor.warning.cpa = 9;
      collisionProfiles.coastal.danger.cpa = 8;

      screen.getByRole("button", { name: /restore defaults/i }).click();

      expect(collisionProfiles.harbor.warning.cpa).toBe(0.5);
      expect(collisionProfiles.coastal.danger.cpa).toBe(1);
    });

    it("can be used more than once", () => {
      render(EditProfiles);

      for (const value of [9, 8, 7]) {
        collisionProfiles.offshore.warning.cpa = value;
        screen.getByRole("button", { name: /restore defaults/i }).click();
        expect(collisionProfiles.offshore.warning.cpa).toBe(4);
      }
    });
  });
});
