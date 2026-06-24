import ky from "ky";
import { name as PLUGIN_ID } from "../../../package.json";
import type { CollisionProfiles, Vessel } from "../../types";
import { isValidCollisionProfiles } from "../../engine/validateCollisionProfiles";
import type { Chart, Context } from "@signalk/server-api";

// retrieves configuration data from signal k server via plugin
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

// validates and then saves configuration data to signal k server via plugin
export async function saveCollisionProfiles(data: CollisionProfiles) {
  console.log("saving collision profiles", data);
  try {
    if (!isValidCollisionProfiles(data)) {
      return { success: false, reason: "invalid-data" };
    }
    await ky.put(`/plugins/${PLUGIN_ID}/saveCollisionProfiles`, {
      credentials: "include",
      json: data,
    });
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, reason: "request-failed", error: e };
  }
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

export async function getVessels() {
  const data: Vessel[] = await ky(`/plugins/${PLUGIN_ID}/getVessels`, {
    credentials: "include",
  }).json();
  return data;
}

export async function getMutedVessels() {
  const data: Vessel[] = await ky(`/plugins/${PLUGIN_ID}/getMutedVessels`, {
    credentials: "include",
  }).json();
  return data;
}

export async function pushMuteAllAlarms() {
  await ky(`/plugins/${PLUGIN_ID}/muteAllAlarms`, {
    credentials: "include",
  });
}

export async function pushAlarmIsMuted(
  context: Context,
  alarmIsMuted: boolean,
) {
  await ky(
    `/plugins/${PLUGIN_ID}/setAlarmIsMuted/${encodeURIComponent(context)}/${alarmIsMuted}`,
    {
      credentials: "include",
    },
  );
}
