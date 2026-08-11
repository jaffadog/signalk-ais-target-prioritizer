import { name as PLUGIN_ID } from "../../../package.json";

// every Signal K webapp and the server admin UI share one origin, so bare keys
// like "theme" collide across them
const PREFIX = `${PLUGIN_ID}.`;

export function getStored(key: string): string | null {
  return localStorage.getItem(PREFIX + key);
}

export function setStored(key: string, value: string) {
  localStorage.setItem(PREFIX + key, value);
}
