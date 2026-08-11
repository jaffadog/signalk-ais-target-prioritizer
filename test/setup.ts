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
