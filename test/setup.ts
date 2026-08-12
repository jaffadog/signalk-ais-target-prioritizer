// Several app modules read localStorage as they load (ui.svelte.ts resolves the
// stored theme, map.svelte.ts the stored basemap), so anything importing them
// needs it to exist before the import runs. A map is enough - tests that care
// about the storage behaviour itself install their own instrumented version.

const store = new Map<string, string>();

const localStorageStub: Storage = {
  getItem: (key) => (store.has(key) ? store.get(key)! : null),
  setItem: (key, value) => void store.set(key, String(value)),
  removeItem: (key) => void store.delete(key),
  clear: () => store.clear(),
  key: (index) => [...store.keys()][index] ?? null,
  get length() {
    return store.size;
  },
};

globalThis.localStorage ??= localStorageStub;

// resolveMapConfig builds absolute urls for charts the signal k server hosts, so
// it needs an origin. Only that one property is used, so a full dom is overkill.
globalThis.window ??= {
  location: { origin: "http://localhost:3000" },
} as Window & typeof globalThis;

// jsdom has no ResizeObserver, and the zag slider behind the alarm threshold
// controls measures its thumb with one. A no-op is enough: nothing under test
// depends on being told about a resize.
class ResizeObserverStub implements ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver ??= ResizeObserverStub;

// jsdom has no CSS object; zag builds id selectors with CSS.escape
globalThis.CSS ??= {
  escape: (value: string) => String(value).replace(/([^\w-])/g, "\\$1"),
} as typeof CSS;
if (typeof globalThis.window === "object" && globalThis.window !== null) {
  (
    globalThis.window as { ResizeObserver?: typeof ResizeObserver }
  ).ResizeObserver ??= ResizeObserverStub;
}
