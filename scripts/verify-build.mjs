// Fails the build if the bundle references an asset that was never emitted.
//
// Vite rewrites emitted assets as `new URL("name", import.meta.url)`. If a
// dependency instead computes an asset url at runtime - maplibre v6 derives its
// worker filename from its own script url - rollup cannot see the reference and
// silently omits the file. Servers with an SPA fallback then answer the request
// with index.html and a 200, so nothing looks wrong: no 404, no console error,
// just a feature that never works. That shipped once; this is the guard.

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ASSETS = "public/assets";

if (!existsSync(ASSETS)) {
  console.error(`verify-build: ${ASSETS} missing - run the build first`);
  process.exit(1);
}

const present = new Set(readdirSync(ASSETS));
const entries = readdirSync(ASSETS).filter(
  (f) => f.startsWith("index-") && f.endsWith(".js"),
);

const missing = [];

for (const entry of entries) {
  const code = readFileSync(join(ASSETS, entry), "utf8");
  // new URL("some-asset.js", import.meta.url)
  for (const [, referenced] of code.matchAll(
    /new URL\([`'"]([^`'"]+)[`'"],\s*import\.meta\.url\)/g,
  )) {
    const file = referenced.replace(/^\.?\//, "").split("?")[0];
    if (!present.has(file)) missing.push({ entry, referenced });
  }
}

if (missing.length) {
  console.error(
    "verify-build: bundle references assets that were not emitted:",
  );
  for (const { entry, referenced } of missing) {
    console.error(`  ${entry} -> ${referenced}`);
  }
  process.exit(1);
}

// The generic check above cannot see maplibre's own worker reference, because it
// builds the url at runtime rather than as a literal rollup can rewrite. So state
// the requirement directly: if maplibre is in the bundle, a worker must ship with
// it, or the map draws its controls and nothing else.
const usesMaplibreWorker = entries.some((entry) =>
  readFileSync(join(ASSETS, entry), "utf8").includes("maplibre-gl-worker"),
);
const workerEmitted = [...present].some((f) =>
  /^maplibre-gl-worker.*\.js$/.test(f),
);

if (usesMaplibreWorker && !workerEmitted) {
  console.error(
    "verify-build: the bundle needs maplibre's worker but no worker asset was emitted.\n" +
      "  maplibre computes the worker url at runtime, so it has to be imported\n" +
      '  explicitly - see the "?worker&url" import and setWorkerUrl in Map.svelte.',
  );
  process.exit(1);
}

console.log(
  `verify-build: ok - ${entries.length} entry chunk(s), all referenced assets present` +
    (workerEmitted ? ", maplibre worker emitted" : ""),
);
