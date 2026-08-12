import { describe, it, expect } from "vitest";

import {
  calcAlarms,
  calcBearing,
  calcCpa,
  calcCpaLocation,
  calcIsLost,
  calcIsValid,
  calcLastSeenSecondsAgo,
  calcPredictedLocation,
  calcProjection,
  calcRange,
  calcVelocity,
  isValidLatLng,
  isValidNumber,
  toDeg,
  toRad,
} from "../src/engine/calculations";
import {
  COURSE_PROJECTION_MINUTES,
  CPA_CEILING_NM,
  KNOTS_PER_M_PER_S,
  LOST_VESSEL_WARNING_AGE,
  METERS_PER_NM,
  ORDER_BAND,
  ORDER_OPENING,
  RANGE_CEILING_NM,
  TCPA_CEILING,
} from "../src/engine/constants";
import type { CollisionProfile, Vessel } from "../src/types";

// sog is metres per second and cog is radians, matching what ingestion produces
function vessel(overrides: Partial<Vessel> = {}): Vessel {
  return {
    latitude: 0,
    longitude: 0,
    sog: null,
    cog: null,
    lastSeenDate: null,
    ...overrides,
  } as Vessel;
}

const knots = (kn: number) => kn / KNOTS_PER_M_PER_S;
const NORTH = 0;
const EAST = Math.PI / 2;
const SOUTH = Math.PI;

// the offshore defaults, so the thresholds under test are ones that ship
const offshore: CollisionProfile = {
  warning: { cpa: 4, tcpa: 30, speed: 0 },
  danger: { cpa: 2, tcpa: 15, speed: 0 },
  guard: { range: 0, speed: 0 },
};

describe("toRad / toDeg", () => {
  it("converts the cardinal angles", () => {
    expect(toRad(180)).toBeCloseTo(Math.PI, 10);
    expect(toDeg(Math.PI)).toBeCloseTo(180, 10);
  });

  it("round trips", () => {
    expect(toDeg(toRad(123.456))).toBeCloseTo(123.456, 10);
  });
});

describe("calcProjection", () => {
  it("gives up when either vessel has no position", () => {
    const me = vessel();
    expect(calcProjection(vessel({ latitude: null }), me)).toBeUndefined();
    expect(calcProjection(vessel({ longitude: null }), me)).toBeUndefined();
    expect(calcProjection(me, vessel({ latitude: null }))).toBeUndefined();
  });

  it("puts north in +y and east in +x", () => {
    const me = vessel();
    const north = calcProjection(vessel({ latitude: 1 }), me)!;
    expect(north.y).toBeGreaterThan(0);
    expect(north.x).toBeCloseTo(0, 6);

    const east = calcProjection(vessel({ longitude: 1 }), me)!;
    expect(east.x).toBeGreaterThan(0);
    expect(east.y).toBeCloseTo(0, 6);
  });

  it("measures one degree of latitude as about 111 km", () => {
    const p = calcProjection(vessel({ latitude: 1 }), vessel())!;
    expect(p.y).toBeGreaterThan(110_000);
    expect(p.y).toBeLessThan(112_000);
  });

  it("shrinks longitude towards the poles", () => {
    const atEquator = calcProjection(vessel({ longitude: 1 }), vessel())!;
    const atSixty = calcProjection(
      vessel({ longitude: 1, latitude: 60 }),
      vessel({ latitude: 60 }),
    )!;
    // cos(60) = 0.5
    expect(atSixty.x).toBeCloseTo(atEquator.x / 2, 0);
  });
});

describe("calcRange", () => {
  it("is the hypotenuse", () => {
    expect(calcRange({ x: 3, y: 4 })).toBe(5);
    expect(calcRange({ x: 0, y: 0 })).toBe(0);
  });

  it("ignores direction", () => {
    expect(calcRange({ x: -3, y: -4 })).toBe(5);
  });
});

describe("calcBearing", () => {
  it("reads clockwise from north", () => {
    expect(calcBearing({ x: 0, y: 1 })).toBeCloseTo(0, 6);
    expect(calcBearing({ x: 1, y: 0 })).toBeCloseTo(90, 6);
    expect(calcBearing({ x: 0, y: -1 })).toBeCloseTo(180, 6);
    expect(calcBearing({ x: -1, y: 0 })).toBeCloseTo(270, 6);
  });

  it("always returns 0..360 rather than a negative angle", () => {
    for (const p of [
      { x: -1, y: 1 },
      { x: -1, y: -1 },
      { x: -0.001, y: 1 },
    ]) {
      const bearing = calcBearing(p);
      expect(bearing).toBeGreaterThanOrEqual(0);
      expect(bearing).toBeLessThan(360);
    }
  });
});

describe("calcVelocity", () => {
  it("treats a vessel with no sog or cog as stopped, so cpa can still run", () => {
    expect(calcVelocity(vessel({ sog: null, cog: 0 }))).toEqual({ x: 0, y: 0 });
    expect(calcVelocity(vessel({ sog: 5, cog: null }))).toEqual({ x: 0, y: 0 });
  });

  it("resolves course into components", () => {
    const north = calcVelocity(vessel({ sog: 10, cog: NORTH }));
    expect(north.x).toBeCloseTo(0, 10);
    expect(north.y).toBeCloseTo(10, 10);

    const east = calcVelocity(vessel({ sog: 10, cog: EAST }));
    expect(east.x).toBeCloseTo(10, 10);
    expect(east.y).toBeCloseTo(0, 10);
  });

  it("keeps the speed as the magnitude on a diagonal", () => {
    const v = calcVelocity(vessel({ sog: 10, cog: toRad(45) }));
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(10, 10);
  });
});

describe("calcCpa", () => {
  const stopped = { x: 0, y: 0 };

  it("finds a head on collision", () => {
    // target 1 NM due north, closing at 10 kn, me stopped
    const projection = { x: 0, y: METERS_PER_NM };
    const velocity = calcVelocity(vessel({ sog: knots(10), cog: SOUTH }));

    const result = calcCpa(projection, velocity, stopped)!;

    // 1852 m at 5.144 m/s is 360 s, and it passes right through me
    expect(result.tcpa).toBeCloseTo(METERS_PER_NM / knots(10), 6);
    expect(result.cpa).toBeCloseTo(0, 6);
  });

  it("returns nothing when the target is opening (cpa already past)", () => {
    const projection = { x: 0, y: METERS_PER_NM };
    const velocity = calcVelocity(vessel({ sog: knots(10), cog: NORTH }));

    expect(calcCpa(projection, velocity, stopped)).toBeUndefined();
  });

  it("returns nothing when there is no relative motion", () => {
    const projection = { x: 0, y: METERS_PER_NM };
    const velocity = calcVelocity(vessel({ sog: knots(10), cog: NORTH }));

    // both on the same course and speed - the range never changes
    expect(calcCpa(projection, velocity, velocity)).toBeUndefined();
  });

  it("reports the current range when the target is already at its cpa", () => {
    // target abeam to the east, tracking north: it is neither closing nor opening
    const projection = { x: METERS_PER_NM, y: 0 };
    const velocity = calcVelocity(vessel({ sog: knots(10), cog: NORTH }));

    const result = calcCpa(projection, velocity, stopped)!;

    expect(result.tcpa).toBeCloseTo(0, 6);
    expect(result.cpa).toBeCloseTo(METERS_PER_NM, 6);
  });

  it("finds the miss distance on a crossing target", () => {
    // 10 NM north, heading west at 10 kn, so it crosses 10 NM ahead of me
    const projection = { x: 0, y: 10 * METERS_PER_NM };
    const velocity = calcVelocity(vessel({ sog: knots(10), cog: toRad(270) }));

    const result = calcCpa(projection, velocity, stopped)!;

    expect(result.tcpa).toBeCloseTo(0, 6);
    expect(result.cpa).toBeCloseTo(10 * METERS_PER_NM, 6);
  });

  it("accounts for my own motion, not just the target's", () => {
    const projection = { x: 0, y: METERS_PER_NM };
    // target stopped, me steaming north at it
    const mine = calcVelocity(vessel({ sog: knots(10), cog: NORTH }));

    const result = calcCpa(projection, { x: 0, y: 0 }, mine)!;

    expect(result.tcpa).toBeCloseTo(METERS_PER_NM / knots(10), 6);
    expect(result.cpa).toBeCloseTo(0, 6);
  });
});

describe("calcCpaLocation", () => {
  it("gives up without a position, course or speed", () => {
    expect(calcCpaLocation(vessel({ latitude: null }), 60)).toBeUndefined();
    expect(calcCpaLocation(vessel({ sog: null, cog: 0 }), 60)).toBeUndefined();
    expect(calcCpaLocation(vessel({ sog: 5, cog: null }), 60)).toBeUndefined();
  });

  it("projects along the course by speed times tcpa", () => {
    const v = vessel({ latitude: 0, longitude: 0, sog: knots(10), cog: NORTH });
    const [lon, lat] = calcCpaLocation(v, 360)!;

    // 360 s at 10 kn is 1 NM, due north
    expect(lon).toBeCloseTo(0, 6);
    expect(lat).toBeGreaterThan(0);
    expect(lat * 60).toBeCloseTo(1, 1);
  });

  it("stays put when tcpa is zero", () => {
    const v = vessel({
      latitude: 10,
      longitude: 20,
      sog: knots(10),
      cog: EAST,
    });
    const [lon, lat] = calcCpaLocation(v, 0)!;
    expect(lon).toBeCloseTo(20, 6);
    expect(lat).toBeCloseTo(10, 6);
  });
});

describe("calcPredictedLocation", () => {
  it("gives up without a position, course or speed", () => {
    expect(calcPredictedLocation(vessel({ latitude: null }))).toBeUndefined();
    expect(
      calcPredictedLocation(vessel({ sog: null, cog: 0 })),
    ).toBeUndefined();
  });

  it("projects the configured number of minutes ahead", () => {
    const v = vessel({ latitude: 0, longitude: 0, sog: knots(60), cog: NORTH });
    const [, lat] = calcPredictedLocation(v)!;

    // 60 kn covers 1 NM per minute, so it should be COURSE_PROJECTION_MINUTES away
    expect(lat * 60).toBeCloseTo(COURSE_PROJECTION_MINUTES, 1);
  });

  it("does not move a stopped vessel", () => {
    const v = vessel({ latitude: 5, longitude: 5, sog: 0, cog: NORTH });
    const [lon, lat] = calcPredictedLocation(v)!;
    expect(lon).toBeCloseTo(5, 6);
    expect(lat).toBeCloseTo(5, 6);
  });
});

describe("calcLastSeenSecondsAgo", () => {
  it("is undefined when the vessel has never been seen", () => {
    expect(calcLastSeenSecondsAgo(vessel())).toBeUndefined();
  });

  it("measures elapsed seconds", () => {
    const v = vessel({ lastSeenDate: new Date(Date.now() - 30_000) });
    expect(calcLastSeenSecondsAgo(v)).toBeGreaterThanOrEqual(29);
    expect(calcLastSeenSecondsAgo(v)).toBeLessThanOrEqual(31);
  });

  it("clamps a future timestamp to zero rather than going negative", () => {
    const v = vessel({ lastSeenDate: new Date(Date.now() + 60_000) });
    expect(calcLastSeenSecondsAgo(v)).toBe(0);
  });
});

describe("calcIsLost", () => {
  it("is lost only past the warning age", () => {
    expect(calcIsLost(0)).toBe(false);
    expect(calcIsLost(LOST_VESSEL_WARNING_AGE - 1)).toBe(false);
    expect(calcIsLost(LOST_VESSEL_WARNING_AGE + 1)).toBe(true);
  });

  it("treats an unusable age as lost", () => {
    expect(calcIsLost(NaN)).toBe(true);
    expect(calcIsLost(undefined as unknown as number)).toBe(true);
  });
});

describe("calcIsValid", () => {
  it("requires both a latitude and a longitude", () => {
    expect(calcIsValid(vessel({ latitude: 1, longitude: 2 }))).toBe(true);
    expect(calcIsValid(vessel({ latitude: null }))).toBe(false);
    expect(calcIsValid(vessel({ longitude: null }))).toBe(false);
    expect(calcIsValid(vessel({ latitude: NaN }))).toBe(false);
  });

  it("accepts a position on the null island", () => {
    expect(calcIsValid(vessel({ latitude: 0, longitude: 0 }))).toBe(true);
  });
});

describe("isValidNumber", () => {
  it("accepts only finite numbers", () => {
    expect(isValidNumber(0)).toBe(true);
    expect(isValidNumber(-1.5)).toBe(true);
    expect(isValidNumber(NaN)).toBe(false);
    expect(isValidNumber(Infinity)).toBe(false);
    expect(isValidNumber(null)).toBe(false);
    expect(isValidNumber(undefined)).toBe(false);
    expect(isValidNumber("5")).toBe(false);
  });
});

describe("isValidLatLng", () => {
  it("accepts positions inside the bounds", () => {
    expect(isValidLatLng(0, 0)).toBe(true);
    expect(isValidLatLng(90, 180)).toBe(true);
    expect(isValidLatLng(-90, -180)).toBe(true);
  });

  it("rejects positions outside the bounds", () => {
    expect(isValidLatLng(91, 0)).toBe(false);
    expect(isValidLatLng(-91, 0)).toBe(false);
    expect(isValidLatLng(0, 181)).toBe(false);
    expect(isValidLatLng(0, -181)).toBe(false);
  });

  it("rejects non numbers", () => {
    expect(isValidLatLng(null, 0)).toBe(false);
    expect(isValidLatLng(0, "0")).toBe(false);
    expect(isValidLatLng(NaN, NaN)).toBe(false);
  });
});

describe("calcAlarms", () => {
  const noAlarm = {
    range: undefined,
    sog: null,
    cpa: undefined,
    tcpa: undefined,
  };

  function alarms(o: Partial<typeof noAlarm> & { mmsi?: string | null } = {}) {
    const { range, sog, cpa, tcpa, mmsi = null } = { ...noAlarm, ...o };
    return calcAlarms(offshore, range, sog, cpa, tcpa, mmsi);
  }

  it("raises no alarm for a distant target", () => {
    const a = alarms({ range: 50 * METERS_PER_NM });
    expect(a.alarmState).toBeNull();
    expect(a.alarmType).toBeNull();
  });

  describe("collision alarm and warning", () => {
    it("raises danger inside the danger cpa and tcpa", () => {
      const a = alarms({ cpa: 1 * METERS_PER_NM, tcpa: 10 * 60 });
      expect(a.collisionAlarm).toBe(true);
      expect(a.alarmState).toBe("danger");
      expect(a.alarmType).toBe("cpa");
    });

    it("raises only a warning between the danger and warning cpa", () => {
      const a = alarms({ cpa: 3 * METERS_PER_NM, tcpa: 10 * 60 });
      expect(a.collisionAlarm).toBe(false);
      expect(a.collisionWarning).toBe(true);
      expect(a.alarmState).toBe("warning");
    });

    it("stays quiet beyond the warning cpa", () => {
      const a = alarms({ cpa: 5 * METERS_PER_NM, tcpa: 10 * 60 });
      expect(a.collisionWarning).toBe(false);
      expect(a.alarmState).toBeNull();
    });

    it("stays quiet when the cpa is too far off in time", () => {
      const a = alarms({ cpa: 0.5 * METERS_PER_NM, tcpa: 45 * 60 });
      expect(a.collisionAlarm).toBe(false);
      expect(a.collisionWarning).toBe(false);
    });

    it("ignores a cpa that is already behind us", () => {
      const a = alarms({ cpa: 0.1 * METERS_PER_NM, tcpa: -60 });
      expect(a.collisionAlarm).toBe(false);
      expect(a.collisionWarning).toBe(false);
    });
  });

  describe("guard alarm", () => {
    const guarded: CollisionProfile = {
      ...offshore,
      guard: { range: 2, speed: 0 },
    };

    it("fires inside the guard ring", () => {
      const a = calcAlarms(
        guarded,
        1 * METERS_PER_NM,
        null,
        undefined,
        undefined,
        null,
      );
      expect(a.guardAlarm).toBe(true);
      expect(a.alarmState).toBe("danger");
      expect(a.alarmType).toBe("guard");
    });

    it("does not fire outside it", () => {
      const a = calcAlarms(
        guarded,
        3 * METERS_PER_NM,
        null,
        undefined,
        undefined,
        null,
      );
      expect(a.guardAlarm).toBe(false);
    });

    it("is disabled by a zero guard range", () => {
      const a = alarms({ range: 0.0001 });
      expect(a.guardAlarm).toBe(false);
    });

    it("honours a speed threshold", () => {
      const fast: CollisionProfile = {
        ...offshore,
        guard: { range: 2, speed: 5 },
      };
      const slow = calcAlarms(
        fast,
        METERS_PER_NM,
        knots(1),
        undefined,
        undefined,
        null,
      );
      const quick = calcAlarms(
        fast,
        METERS_PER_NM,
        knots(10),
        undefined,
        undefined,
        null,
      );
      expect(slow.guardAlarm).toBe(false);
      expect(quick.guardAlarm).toBe(true);
    });
  });

  describe("distress mmsi prefixes", () => {
    it("flags SART, MOB and EPIRB by prefix", () => {
      expect(alarms({ mmsi: "970123456" }).sartAlarm).toBe(true);
      expect(alarms({ mmsi: "972123456" }).mobAlarm).toBe(true);
      expect(alarms({ mmsi: "974123456" }).epirbAlarm).toBe(true);
    });

    it("escalates a distress target to danger", () => {
      const a = alarms({ mmsi: "970123456", range: 50 * METERS_PER_NM });
      expect(a.alarmState).toBe("danger");
      expect(a.alarmType).toBe("sart");
    });

    it("leaves an ordinary mmsi alone", () => {
      const a = alarms({ mmsi: "230123456" });
      expect(a.sartAlarm).toBe(false);
      expect(a.mobAlarm).toBe(false);
      expect(a.epirbAlarm).toBe(false);
    });

    it("tolerates a missing mmsi", () => {
      expect(alarms({ mmsi: null }).sartAlarm).toBe(false);
    });
  });

  describe("alarmType", () => {
    it("joins every reason that applies", () => {
      const guarded: CollisionProfile = {
        ...offshore,
        guard: { range: 5, speed: 0 },
      };
      const a = calcAlarms(
        guarded,
        1 * METERS_PER_NM,
        null,
        0.5 * METERS_PER_NM,
        5 * 60,
        "970123456",
      );
      expect(a.alarmType).toBe("guard,cpa,sart");
    });
  });

  describe("ordering", () => {
    it("puts danger ahead of warning, and warning ahead of quiet", () => {
      const danger = alarms({ cpa: 0.5 * METERS_PER_NM, tcpa: 5 * 60 });
      const warning = alarms({ cpa: 3 * METERS_PER_NM, tcpa: 5 * 60 });
      const quiet = alarms({ cpa: 20 * METERS_PER_NM, tcpa: 5 * 60 });

      expect(danger.order!).toBeLessThan(warning.order!);
      expect(warning.order!).toBeLessThan(quiet.order!);
    });

    it("prefers the sooner of two equally close targets", () => {
      const soon = alarms({ cpa: METERS_PER_NM, tcpa: 60 });
      const later = alarms({ cpa: METERS_PER_NM, tcpa: 10 * 60 });
      expect(soon.order!).toBeLessThan(later.order!);
    });

    it("prefers the closer of two equally timed targets", () => {
      const near = alarms({ cpa: 0.5 * METERS_PER_NM, tcpa: 5 * 60 });
      const far = alarms({ cpa: 1.5 * METERS_PER_NM, tcpa: 5 * 60 });
      expect(near.order!).toBeLessThan(far.order!);
    });

    it("prefers the closer of two targets by range", () => {
      const near = alarms({ range: METERS_PER_NM });
      const far = alarms({ range: 10 * METERS_PER_NM });
      expect(near.order!).toBeLessThan(far.order!);
    });

    it("sinks targets with no range below any target of known range", () => {
      const without = alarms({ range: undefined });
      // past the range ceiling too - unknown range must always sort last. this used
      // to cross over around 100 NM, where a real target started sorting lower.
      for (const nm of [0.1, 1, 10, 50, 99, 101, 500, 5000]) {
        expect(without.order!).toBeGreaterThan(
          alarms({ range: nm * METERS_PER_NM }).order!,
        );
      }
    });

    it("stops ordering by range past the ceiling rather than growing unbounded", () => {
      const at = alarms({ range: RANGE_CEILING_NM * METERS_PER_NM });
      const beyond = alarms({ range: 10 * RANGE_CEILING_NM * METERS_PER_NM });
      expect(beyond.order!).toBe(at.order!);
    });
  });

  // a tie breaker that can grow as large as the gap between bands stops being a tie
  // breaker - it silently promotes or demotes targets across severities. range used
  // to add 1000 per NM against bands 100000 apart, so 100 NM was a whole band.
  describe("priority bands survive the tie breakers", () => {
    const distress = "970123456"; // sart - alarms on mmsi prefix, at any range

    it("keeps a distant distress target ahead of a close collision warning", () => {
      const sartFarOut = alarms({ range: 150 * METERS_PER_NM, mmsi: distress });
      const warningClose = alarms({
        range: 1 * METERS_PER_NM,
        cpa: 3 * METERS_PER_NM,
        tcpa: 5 * 60,
      });
      expect(sartFarOut.alarmState).toBe("danger");
      expect(warningClose.alarmState).toBe("warning");
      expect(sartFarOut.order!).toBeLessThan(warningClose.order!);
    });

    it("never lets the tie breakers add up to a whole band", () => {
      // worst case: unknown range, plus both other tie breakers well past their ceilings
      const worst = alarms({
        range: undefined,
        cpa: 10 * CPA_CEILING_NM * METERS_PER_NM,
        tcpa: 10 * TCPA_CEILING,
      });
      expect(worst.order!).toBeLessThan(ORDER_OPENING + ORDER_BAND);
    });

    it("keeps order inside the range the symbol sort key is derived from", () => {
      // vessels render with `999999 - order`, which has to stay positive
      const worst = alarms({
        range: 20_000 * METERS_PER_NM,
        cpa: 10 * CPA_CEILING_NM * METERS_PER_NM,
        tcpa: 10 * TCPA_CEILING,
      });
      expect(worst.order!).toBeLessThan(999999);
    });
  });
});
