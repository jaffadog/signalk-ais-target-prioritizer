import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

import {
  alarmsState,
  getAlarmVesselList,
  getCounts,
  mute,
  muteAllAlarms,
  setAlarmIsMuted,
} from "../src/engine/alarms.svelte";
import {
  createVessel,
  vessels,
  vesselsState,
} from "../src/engine/vessels.svelte";
import type { Context } from "@signalk/server-api";
import type { Vessel } from "../src/types";

const ctx = (id: string) => `vessels.urn:mrn:imo:mmsi:${id}` as Context;

// a target that has a position and so counts towards the totals
function target(id: string, overrides: Partial<Vessel> = {}) {
  const context = ctx(id);
  vessels[context] = {
    ...createVessel(context),
    latitude: 0,
    longitude: 0,
    isValid: true,
    ...overrides,
  };
  return vessels[context];
}

beforeEach(() => {
  for (const key of Object.keys(vessels)) delete vessels[key as Context];
  vesselsState.myVesselContext = null;
  alarmsState.alarmsEnabled = false;
  alarmsState.lastAlarmTime = null;
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe("setAlarmIsMuted", () => {
  it("mutes and unmutes a known vessel", () => {
    const v = target("1");
    setAlarmIsMuted(ctx("1"), true);
    expect(v.alarmIsMuted).toBe(true);
    setAlarmIsMuted(ctx("1"), false);
    expect(v.alarmIsMuted).toBe(false);
  });

  it("ignores a context it has never seen", () => {
    expect(() => setAlarmIsMuted(ctx("nope"), true)).not.toThrow();
  });

  it("does not touch other vessels", () => {
    const a = target("1");
    const b = target("2");
    setAlarmIsMuted(ctx("1"), true);
    expect(a.alarmIsMuted).toBe(true);
    expect(b.alarmIsMuted).toBe(false);
  });
});

describe("mute", () => {
  it("is setAlarmIsMuted(true)", () => {
    const v = target("1");
    mute(ctx("1"));
    expect(v.alarmIsMuted).toBe(true);
  });
});

describe("getAlarmVesselList", () => {
  it("lists only unmuted danger targets", () => {
    target("1", { alarmState: "danger" });
    target("2", { alarmState: "warning" });
    target("3", { alarmState: null });
    target("4", { alarmState: "danger", alarmIsMuted: true });

    expect(getAlarmVesselList().map((v) => v.context)).toEqual([ctx("1")]);
  });

  it("empties as targets are muted", () => {
    target("1", { alarmState: "danger" });
    target("2", { alarmState: "danger" });
    expect(getAlarmVesselList()).toHaveLength(2);

    mute(ctx("1"));
    expect(getAlarmVesselList()).toHaveLength(1);
  });

  it("is empty with no vessels at all", () => {
    expect(getAlarmVesselList()).toHaveLength(0);
  });
});

describe("muteAllAlarms", () => {
  it("mutes every currently alarming target", () => {
    const a = target("1", { alarmState: "danger" });
    const b = target("2", { alarmState: "danger" });

    muteAllAlarms();

    expect(a.alarmIsMuted).toBe(true);
    expect(b.alarmIsMuted).toBe(true);
    expect(getAlarmVesselList()).toHaveLength(0);
  });

  it("leaves warnings alone, since only danger raises the dialog", () => {
    const warned = target("1", { alarmState: "warning" });
    muteAllAlarms();
    expect(warned.alarmIsMuted).toBe(false);
  });

  // it snapshots the list first, so muting while iterating cannot skip entries
  it("mutes all of a long list", () => {
    for (let i = 0; i < 40; i++) target(String(i), { alarmState: "danger" });
    muteAllAlarms();
    expect(getAlarmVesselList()).toHaveLength(0);
  });
});

describe("getCounts", () => {
  it("counts valid targets, and those in warning or danger", () => {
    target("1", { alarmState: null });
    target("2", { alarmState: "warning" });
    target("3", { alarmState: "danger" });

    expect(getCounts()).toEqual({ total: 3, filtered: 2, danger: 1 });
  });

  it("excludes our own vessel from the totals", () => {
    const mine = ctx("mine");
    vesselsState.myVesselContext = mine;
    vessels[mine] = {
      ...createVessel(mine),
      isValid: true,
      alarmState: "danger",
    };
    target("1");

    expect(getCounts()).toEqual({ total: 1, filtered: 0, danger: 0 });
  });

  it("excludes targets with no usable position", () => {
    target("1");
    target("2", { isValid: false });

    expect(getCounts().total).toBe(1);
  });

  it("counts a muted danger target - muting silences the alarm, it does not hide the target", () => {
    target("1", { alarmState: "danger", alarmIsMuted: true });

    expect(getCounts()).toEqual({ total: 1, filtered: 1, danger: 1 });
    expect(getAlarmVesselList()).toHaveLength(0);
  });

  it("is all zeroes with no vessels", () => {
    expect(getCounts()).toEqual({ total: 0, filtered: 0, danger: 0 });
  });

  it("tracks vessels being removed", () => {
    target("1");
    target("2");
    expect(getCounts().total).toBe(2);

    delete vessels[ctx("1")];
    expect(getCounts().total).toBe(1);
  });
});
