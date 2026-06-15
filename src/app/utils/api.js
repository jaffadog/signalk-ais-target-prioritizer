import ky from "ky";
import { name as pluginName } from "../../../package.json";

export async function loadCollisionProfiles() {
  console.log("loading collision profiles");
  try {
    const data = await ky(`/plugins/${pluginName}/loadCollisionProfiles`, {
      credentials: "include",
    }).json();
    console.log("loaded collision profiles", data);
    return data;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function saveCollisionProfiles(data) {
  console.log("saving collision profiles", data);
  ky.put(`/plugins/${pluginName}/saveCollisionProfiles`, {
    credentials: "include",
    json: data,
  });
}

export async function getPmtiles() {
  const data = await ky("/signalk/pmtiles", {
    credentials: "include",
  }).json();
  return data;
}

export async function getCharts() {
  const data = await ky("/signalk/v1/api/resources/charts", {
    credentials: "include",
  }).json();
  return data;
}

export async function getSelf() {
  const data = await ky("/signalk/v1/api/vessels/self", {
    credentials: "include",
  }).json();
  return data;
}

export async function getTargets() {
  const data = await ky(`/plugins/${pluginName}/getTargets`, {
    credentials: "include",
  }).json();
  return data;
}

export async function pushMuteAllAlarms() {
  await ky(`/plugins/${pluginName}/muteAllAlarms`, {
    credentials: "include",
  });
}

export async function pushAlarmIsMuted(mmsi, alarmIsMuted) {
  await ky(`/plugins/${pluginName}/setAlarmIsMuted/${mmsi}/${alarmIsMuted}`, {
    credentials: "include",
  });
}
