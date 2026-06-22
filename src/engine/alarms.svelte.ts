// reads vessels, raises notifications
import type { Context } from "@signalk/server-api";
import type { AlarmsState } from "../types.js";
import { vessels, vesselsState } from "./vessels.svelte.js";

export const alarmsState = $state<AlarmsState>({
  alarmsEnabled: false,
  lastAlarmTime: null,
});

export function setAlarmIsMuted(context: Context, alarmIsMuted: boolean) {
  const vessel = vessels[context];
  if (!vessel) return;
  console.log({ context, name: vessel.name, alarmIsMuted });
  vessel.alarmIsMuted = alarmIsMuted;
}

export function mute(context: Context) {
  setAlarmIsMuted(context, true);
}

export function muteAllAlarms() {
  for (const alarm of $state.snapshot(alarmVesselList)) {
    mute(alarm.context);
  }
}

const alarmVesselList = $derived(
  Object.values(vessels).filter(
    (t) => t.alarmState === "danger" && t.alarmIsMuted === false,
  ),
);

export function getAlarmVesselList() {
  return alarmVesselList;
}

const counts = $derived.by(() => {
  let total = 0,
    filtered = 0,
    danger = 0;

  for (const vessel of Object.values(vessels)) {
    if (vessel.isValid && vessel.context !== vesselsState.myVesselContext) {
      total++;
      const state = vessel.alarmState;
      if (state) {
        filtered++;
        if (state === "danger") danger++;
      }
    }
  }

  return { total, filtered, danger };
});

export function getCounts() {
  return counts;
}
