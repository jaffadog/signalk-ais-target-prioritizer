import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

import {
  collisionProfiles,
  getActiveCollisionProfile,
  getActiveCollisionProfileName,
  resetCollisionProfiles,
  setCollisionProfiles,
} from "../src/engine/collisionProfiles.svelte";
import { isValidCollisionProfiles } from "../src/engine/validateCollisionProfiles";
import type { CollisionProfiles } from "../src/types";

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  resetCollisionProfiles();
});

afterEach(() => vi.restoreAllMocks());

describe("the shipped defaults", () => {
  it("pass their own validator, so a fresh install cannot be rejected", () => {
    expect(isValidCollisionProfiles(collisionProfiles)).toBe(true);
  });

  it("start on offshore", () => {
    expect(collisionProfiles.current).toBe("offshore");
  });

  it("define all four profiles", () => {
    for (const name of ["anchor", "harbor", "coastal", "offshore"] as const) {
      expect(collisionProfiles[name]).toBeDefined();
    }
  });

  it("keep danger at least as tight as warning, so danger cannot fire first", () => {
    for (const name of ["harbor", "coastal", "offshore"] as const) {
      const { warning, danger } = collisionProfiles[name];
      expect(danger.cpa, name).toBeLessThanOrEqual(warning.cpa);
      expect(danger.tcpa, name).toBeLessThanOrEqual(warning.tcpa);
    }
  });

  it("tighten as the profiles move inshore", () => {
    // a harbour wants a much closer cpa than open water before it complains
    expect(collisionProfiles.harbor.warning.cpa).toBeLessThan(
      collisionProfiles.coastal.warning.cpa,
    );
    expect(collisionProfiles.coastal.warning.cpa).toBeLessThan(
      collisionProfiles.offshore.warning.cpa,
    );
  });

  it("leave the guard ring off by default in every profile", () => {
    for (const name of ["anchor", "harbor", "coastal", "offshore"] as const) {
      expect(collisionProfiles[name].guard.range, name).toBe(0);
    }
  });
});

describe("getActiveCollisionProfile", () => {
  it("returns the profile named by current", () => {
    collisionProfiles.current = "harbor";
    expect(getActiveCollisionProfile()).toBe(collisionProfiles.harbor);
    expect(getActiveCollisionProfileName()).toBe("harbor");
  });

  it("follows current as it changes", () => {
    collisionProfiles.current = "anchor";
    expect(getActiveCollisionProfile()).toBe(collisionProfiles.anchor);
    collisionProfiles.current = "offshore";
    expect(getActiveCollisionProfile()).toBe(collisionProfiles.offshore);
  });
});

describe("setCollisionProfiles", () => {
  const custom: CollisionProfiles = {
    current: "coastal",
    anchor: {
      warning: { cpa: 1, tcpa: 1, speed: 1 },
      danger: { cpa: 1, tcpa: 1, speed: 1 },
      guard: { range: 1, speed: 1 },
    },
    harbor: {
      warning: { cpa: 2, tcpa: 2, speed: 2 },
      danger: { cpa: 2, tcpa: 2, speed: 2 },
      guard: { range: 2, speed: 2 },
    },
    coastal: {
      warning: { cpa: 3, tcpa: 3, speed: 3 },
      danger: { cpa: 3, tcpa: 3, speed: 3 },
      guard: { range: 3, speed: 3 },
    },
    offshore: {
      warning: { cpa: 4, tcpa: 4, speed: 4 },
      danger: { cpa: 4, tcpa: 4, speed: 4 },
      guard: { range: 4, speed: 4 },
    },
  };

  it("applies loaded settings over the defaults", () => {
    setCollisionProfiles(custom);
    expect(collisionProfiles.current).toBe("coastal");
    expect(collisionProfiles.coastal.warning.cpa).toBe(3);
  });

  it("mutates the existing store rather than replacing it, so subscribers keep working", () => {
    const before = collisionProfiles;
    setCollisionProfiles(custom);
    expect(collisionProfiles).toBe(before);
  });

  it("is reflected by the active profile getter", () => {
    setCollisionProfiles(custom);
    expect(getActiveCollisionProfile().warning.cpa).toBe(3);
  });
});

describe("resetCollisionProfiles", () => {
  it("restores the defaults after edits", () => {
    collisionProfiles.current = "harbor";
    collisionProfiles.offshore.warning.cpa = 9.5;

    resetCollisionProfiles();

    expect(collisionProfiles.current).toBe("offshore");
    expect(collisionProfiles.offshore.warning.cpa).toBe(4);
  });

  it("leaves a valid set behind", () => {
    resetCollisionProfiles();
    expect(isValidCollisionProfiles(collisionProfiles)).toBe(true);
  });

  // regression: $state() proxies the object it is given, so initialising the store
  // with the defaults object made every edit an edit to the defaults too, and
  // "Restore Defaults" then restored the user's own settings. loading settings from
  // the server at startup is enough to trigger it, so it hit real installs.
  it("still restores the shipped values after settings have been loaded and edited", () => {
    // stand in for settings arriving from the server at startup
    setCollisionProfiles({
      ...structuredClone(collisionProfiles),
      current: "harbor",
      offshore: {
        warning: { cpa: 9.5, tcpa: 55, speed: 7 },
        danger: { cpa: 9, tcpa: 50, speed: 6 },
        guard: { range: 8, speed: 5 },
      },
    });
    collisionProfiles.coastal.danger.cpa = 7.25;

    resetCollisionProfiles();

    expect(collisionProfiles.current).toBe("offshore");
    expect(collisionProfiles.offshore.warning.cpa).toBe(4);
    expect(collisionProfiles.offshore.danger.tcpa).toBe(15);
    expect(collisionProfiles.coastal.danger.cpa).toBe(1);
  });

  it("can be reset repeatedly", () => {
    for (let i = 0; i < 3; i++) {
      collisionProfiles.offshore.warning.cpa = i;
      resetCollisionProfiles();
      expect(collisionProfiles.offshore.warning.cpa).toBe(4);
    }
  });
});
