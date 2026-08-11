import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { isValidCollisionProfiles } from "../src/engine/validateCollisionProfiles";
import type { CollisionProfiles } from "../src/types";

// the validator warns on every rejected field, which would bury the test output
beforeEach(() => vi.spyOn(console, "warn").mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

const threshold = { cpa: 1, tcpa: 10, speed: 0 };
const guard = { range: 0, speed: 0 };
const profile = { warning: threshold, danger: threshold, guard };

function profiles(overrides: Record<string, unknown> = {}) {
  return {
    current: "offshore",
    anchor: profile,
    harbor: profile,
    coastal: profile,
    offshore: profile,
    ...overrides,
  };
}

describe("isValidCollisionProfiles", () => {
  it("accepts a complete set", () => {
    expect(isValidCollisionProfiles(profiles())).toBe(true);
  });

  it("accepts every valid profile name as current", () => {
    for (const current of ["anchor", "harbor", "coastal", "offshore"]) {
      expect(isValidCollisionProfiles(profiles({ current }))).toBe(true);
    }
  });

  it("narrows the type when it passes", () => {
    const data: unknown = profiles();
    if (isValidCollisionProfiles(data)) {
      // compiles only because the guard narrowed `data`
      const typed: CollisionProfiles = data;
      expect(typed.current).toBe("offshore");
    } else {
      throw new Error("expected the guard to accept this");
    }
  });

  describe("rejects malformed input", () => {
    it("rejects non objects", () => {
      for (const bad of [null, undefined, 0, "", "offshore", [], true]) {
        expect(isValidCollisionProfiles(bad)).toBe(false);
      }
    });

    it("rejects an unknown current profile", () => {
      expect(isValidCollisionProfiles(profiles({ current: "docked" }))).toBe(
        false,
      );
      expect(isValidCollisionProfiles(profiles({ current: undefined }))).toBe(
        false,
      );
    });

    it("rejects a missing profile", () => {
      expect(isValidCollisionProfiles(profiles({ coastal: undefined }))).toBe(
        false,
      );
    });

    it("rejects a profile missing a section", () => {
      expect(
        isValidCollisionProfiles(
          profiles({ offshore: { warning: threshold, danger: threshold } }),
        ),
      ).toBe(false);
    });
  });

  describe("enforces field ranges", () => {
    const withOffshore = (o: Record<string, unknown>) =>
      profiles({ offshore: { ...profile, ...o } });

    it("caps cpa at 10", () => {
      expect(
        isValidCollisionProfiles(
          withOffshore({ warning: { ...threshold, cpa: 10 } }),
        ),
      ).toBe(true);
      expect(
        isValidCollisionProfiles(
          withOffshore({ warning: { ...threshold, cpa: 11 } }),
        ),
      ).toBe(false);
    });

    it("caps tcpa at 60", () => {
      expect(
        isValidCollisionProfiles(
          withOffshore({ danger: { ...threshold, tcpa: 60 } }),
        ),
      ).toBe(true);
      expect(
        isValidCollisionProfiles(
          withOffshore({ danger: { ...threshold, tcpa: 61 } }),
        ),
      ).toBe(false);
    });

    it("rejects negative values", () => {
      expect(
        isValidCollisionProfiles(
          withOffshore({ warning: { ...threshold, cpa: -1 } }),
        ),
      ).toBe(false);
      expect(
        isValidCollisionProfiles(
          withOffshore({ guard: { ...guard, range: -1 } }),
        ),
      ).toBe(false);
    });

    it("rejects numeric strings, so json from the server cannot slip through", () => {
      expect(
        isValidCollisionProfiles(
          withOffshore({ warning: { ...threshold, cpa: "1" } }),
        ),
      ).toBe(false);
    });

    it("rejects NaN", () => {
      expect(
        isValidCollisionProfiles(
          withOffshore({ warning: { ...threshold, cpa: NaN } }),
        ),
      ).toBe(false);
    });

    it("caps guard range and speed at 10", () => {
      expect(
        isValidCollisionProfiles(
          withOffshore({ guard: { range: 10, speed: 10 } }),
        ),
      ).toBe(true);
      expect(
        isValidCollisionProfiles(
          withOffshore({ guard: { range: 11, speed: 0 } }),
        ),
      ).toBe(false);
      expect(
        isValidCollisionProfiles(
          withOffshore({ guard: { range: 0, speed: 11 } }),
        ),
      ).toBe(false);
    });
  });
});
