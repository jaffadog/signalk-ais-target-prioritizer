import ky from "ky";
import { name as PLUGIN_ID } from "../../../package.json";
import type { CollisionProfiles } from "../../types";
import { isValidCollisionProfiles } from "../../engine/validateCollisionProfiles";
import { toaster } from "./toaster";
import type { Chart } from "@signalk/server-api";

export async function loadCollisionProfiles() {
  console.log("loading collision profiles");
  try {
    const data: CollisionProfiles = await ky(
      `/plugins/${PLUGIN_ID}/loadCollisionProfiles`,
      {
        credentials: "include",
      },
    ).json();
    console.log("loaded collision profiles", data);
    return data;
  } catch (e) {
    console.error(e);
    return;
  }
}

export async function saveCollisionProfiles(data: CollisionProfiles) {
  console.log("saving collision profiles", data);
  if (!isValidCollisionProfiles(data)) {
    toaster.error({
      title: "Error",
      description:
        "Unable to save configuration data. Found invalid configuration data.",
      duration: Infinity,
    });
    return;
  }

  await ky.put(`/plugins/${PLUGIN_ID}/saveCollisionProfiles`, {
    credentials: "include",
    json: data,
  });
}

export async function getPmtiles() {
  const data: string[] = await ky("/signalk/pmtiles", {
    credentials: "include",
  }).json();
  return data;
}

export async function getCharts() {
  const data: Chart[] = await ky("/signalk/v2/api/resources/charts", {
    credentials: "include",
  }).json();
  console.log(data);
  return data;
}

export async function getSelf() {
  const data = await ky("/signalk/v1/api/vessels/self", {
    credentials: "include",
  }).json();
  return data;
}

export async function getTargets() {
  const data = await ky(`/plugins/${PLUGIN_ID}/getTargets`, {
    credentials: "include",
  }).json();
  return data;
}

export async function pushMuteAllAlarms() {
  await ky(`/plugins/${PLUGIN_ID}/muteAllAlarms`, {
    credentials: "include",
  });
}

export async function pushAlarmIsMuted(mmsi: string, alarmIsMuted: boolean) {
  await ky(`/plugins/${PLUGIN_ID}/setAlarmIsMuted/${mmsi}/${alarmIsMuted}`, {
    credentials: "include",
  });
}
