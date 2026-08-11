// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/svelte";

import VesselCounts from "../src/app/components/VesselCounts.svelte";
import Alarms from "../src/app/components/Alarms.svelte";
import {
  createVessel,
  vessels,
  vesselsState,
} from "../src/engine/vessels.svelte";
import { alarmsState, getAlarmVesselList } from "../src/engine/alarms.svelte";
import { ui } from "../src/app/ui.svelte";
import type { Context } from "@signalk/server-api";
import type { Vessel } from "../src/types";

const pushMuteAllAlarms = vi.fn();
vi.mock("../src/app/utils/api", () => ({
  pushMuteAllAlarms: (...a: unknown[]) => pushMuteAllAlarms(...a),
}));

// the alarm dialog plays a horn on mount, which jsdom has no audio for
class SilentAudio {
  play() {
    return Promise.reject(new Error("no audio in jsdom"));
  }
}
vi.stubGlobal("Audio", SilentAudio);

const ctx = (id: string) => `vessels.urn:mrn:imo:mmsi:${id}` as Context;

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
  vesselsState.selectedVesselContext = null;
  ui.alarms.visible = true;
  ui.vesselProperties.visible = false;
  alarmsState.lastAlarmTime = null;
  pushMuteAllAlarms.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("VesselCounts", () => {
  it("shows zeroes with no vessels", () => {
    render(VesselCounts);

    for (const label of ["TARGETS", "FILTERED", "ALARMS"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.getAllByText("0")).toHaveLength(3);
  });

  it("shows the total, the filtered and the alarming counts", () => {
    target("1");
    target("2", { alarmState: "warning" });
    target("3", { alarmState: "danger" });

    render(VesselCounts);

    // 3 total, 2 with any alarm state, 1 in danger
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
  });

  it("leaves our own vessel out of the count", () => {
    const mine = ctx("mine");
    vesselsState.myVesselContext = mine;
    vessels[mine] = { ...createVessel(mine), isValid: true };
    target("1");

    render(VesselCounts);

    // one target, not two
    expect(screen.getAllByText("1")).toHaveLength(1);
    expect(screen.getAllByText("0")).toHaveLength(2);
  });
});

describe("Alarms dialog", () => {
  it("lists the vessels currently in alarm", () => {
    target("1", { name: "FINNFUN", alarmState: "danger" });
    target("2", { name: "KAROLIN", alarmState: "danger" });

    render(Alarms);

    expect(screen.getByText(/FINNFUN/)).toBeTruthy();
    expect(screen.getByText(/KAROLIN/)).toBeTruthy();
  });

  it("leaves out warnings and muted targets", () => {
    target("1", { name: "DANGEROUS", alarmState: "danger" });
    target("2", { name: "WARNED", alarmState: "warning" });
    target("3", { name: "MUTED", alarmState: "danger", alarmIsMuted: true });

    render(Alarms);

    expect(screen.getByText(/DANGEROUS/)).toBeTruthy();
    expect(screen.queryByText(/WARNED/)).toBeNull();
    expect(screen.queryByText(/MUTED/)).toBeNull();
  });

  it("selects the vessel and opens its details when a row is clicked", async () => {
    target("1", { name: "FINNFUN", alarmState: "danger" });

    render(Alarms);
    screen.getByText(/FINNFUN/).click();

    expect(vesselsState.selectedVesselContext).toBe(ctx("1"));
    expect(ui.vesselProperties.visible).toBe(true);
    // and the alarm dialog gets out of the way
    expect(ui.alarms.visible).toBe(false);
  });

  it("mutes every alarm and tells the server when Mute All is used", () => {
    target("1", { name: "FINNFUN", alarmState: "danger" });
    target("2", { name: "KAROLIN", alarmState: "danger" });

    render(Alarms);
    screen.getByRole("button", { name: /mute all/i }).click();

    expect(getAlarmVesselList()).toHaveLength(0);
    expect(pushMuteAllAlarms).toHaveBeenCalledTimes(1);
    expect(ui.alarms.visible).toBe(false);
  });

  it("records when it was dismissed, so it does not immediately reopen", () => {
    target("1", { name: "FINNFUN", alarmState: "danger" });

    render(Alarms);
    screen.getByRole("button", { name: /close/i }).click();

    expect(ui.alarms.visible).toBe(false);
    expect(alarmsState.lastAlarmTime).not.toBeNull();
  });

  it("does not mute anything when merely closed", () => {
    const v = target("1", { name: "FINNFUN", alarmState: "danger" });

    render(Alarms);
    screen.getByRole("button", { name: /close/i }).click();

    expect(v.alarmIsMuted).toBe(false);
  });

  // the list is snapshotted on mount so the dialog does not shuffle under the
  // user's finger as deltas arrive
  it("keeps its list steady when the underlying alarms change", () => {
    target("1", { name: "FINNFUN", alarmState: "danger" });

    render(Alarms);
    target("2", { name: "LATECOMER", alarmState: "danger" });

    expect(screen.queryByText(/LATECOMER/)).toBeNull();
    expect(screen.getByText(/FINNFUN/)).toBeTruthy();
  });
});
