import { describe, it, expect, beforeEach } from "vitest";

import { getStored, setStored } from "../src/app/utils/storage";
import { name as PLUGIN_ID } from "../package.json";

// node has no localStorage, and the point of this module is the key prefix, so a
// plain map backing store is enough to observe what keys it actually writes
const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  globalThis.localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
});

describe("namespaced storage", () => {
  it("prefixes writes with the plugin id", () => {
    setStored("theme", "dark");
    expect([...store.keys()]).toEqual([`${PLUGIN_ID}.theme`]);
  });

  it("reads back what it wrote", () => {
    setStored("basemap", "builtin:street");
    expect(getStored("basemap")).toBe("builtin:street");
  });

  it("is null for a key that was never written", () => {
    expect(getStored("nothing")).toBeNull();
  });

  // the whole reason for the prefix: every signal k webapp and the server admin
  // ui share one origin, so a bare "theme" key collides across them
  it("does not read a bare key written by another app on the same origin", () => {
    store.set("theme", "somebody-elses-value");
    expect(getStored("theme")).toBeNull();
  });

  it("does not overwrite another app's bare key", () => {
    store.set("theme", "somebody-elses-value");
    setStored("theme", "ours");
    expect(store.get("theme")).toBe("somebody-elses-value");
    expect(store.get(`${PLUGIN_ID}.theme`)).toBe("ours");
  });

  it("keeps our own keys separate from each other", () => {
    setStored("theme", "dark");
    setStored("basemap", "builtin:offline");
    expect(getStored("theme")).toBe("dark");
    expect(getStored("basemap")).toBe("builtin:offline");
  });

  it("stringifies non string values, as callers pass booleans and numbers", () => {
    setStored("openseamap", String(true));
    setStored("zoom", String(11.5));
    expect(getStored("openseamap")).toBe("true");
    expect(getStored("zoom")).toBe("11.5");
  });
});
