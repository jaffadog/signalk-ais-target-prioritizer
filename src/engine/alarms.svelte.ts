// reads vessels, raises notifications
import { vessels, vesselsState } from "./vessels.svelte.js";

interface AlarmsState {
  lastAlarmTime: number | null;
}

export const alarmsState = $state<AlarmsState>({
  lastAlarmTime: null,
});

export function setAlarmIsMuted(mmsi: string, alarmIsMuted: boolean) {
  const vessel = vessels[mmsi];
  if (!vessel) return;
  console.log({ mmsi, name: vessel.name, alarmIsMuted });
  vessel.alarmIsMuted = alarmIsMuted;
}

export function mute(mmsi: string) {
  setAlarmIsMuted(mmsi, true);
}

export function muteAllAlarms() {
  for (const alarm of $state.snapshot(alarmList)) {
    mute(alarm.mmsi);
  }
}

const alarmList = $derived(
  Object.values(vessels).filter(
    (t) => t.alarmState === "danger" && t.alarmIsMuted === false,
  ),
);

export function getAlarmList() {
  return alarmList;
}

const counts = $derived.by(() => {
  let total = 0,
    filtered = 0,
    danger = 0;

  for (const vessel of Object.values(vessels)) {
    if (vessel.mmsi !== vesselsState.myVesselMmsi) {
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
