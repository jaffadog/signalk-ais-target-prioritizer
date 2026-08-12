# signalk-ais-target-prioritizer

A Signal K plugin **and** webapp that ranks AIS targets by collision risk. It computes
CPA/TCPA/range/bearing for every target, sorts them into priority order, raises
alarms, and plots them on a map.

## The three-way source split

This is the single most important thing to understand before editing.

| Directory       | Runs in                | Notes                                          |
| --------------- | ---------------------- | ---------------------------------------------- |
| `src/engine/**` | **both** plugin + web  | Pure, dependency-light. Where the math lives.  |
| `src/plugin/**` | Signal K server (Node) | Server-side only.                              |
| `src/app/**`    | browser only           | Svelte 5. The plugin entry never imports this. |
| `src/types.ts`  | both                   | Shared types.                                  |

Two separate build outputs, both gitignored:

- `plugin/index.cjs` — rollup, CJS, server-side. **Requires a Signal K restart.**
- `public/` — vite, the webapp. **Hard reload only** (bundle is hashed, `index.html` is not).

Because the plugin entry only reaches `src/engine`, `src/plugin` and `src/types`, a
change confined to `src/app/**` can never require a server restart. Use that to avoid
telling people to bounce Signal K for no reason.

There are two tsconfigs for the same reason — `tsconfig.app.json` and
`tsconfig.plugin.json` — and `npm run typecheck` runs both.

## Commands

```bash
npm run dev        # vite on :5173, proxies /signalk /plugins /skServer to :3000
npm run checks     # format:check + lint + typecheck + test + build. Also runs as preversion.
npm test           # vitest run
npm run coverage   # istanbul provider (not v8 - see below)
npm run build      # build:web (+ verify:build) then build:plugin
```

`npm run dev` needs a real Signal K server on `127.0.0.1:3000` for data; the proxy is
already configured, including websockets. `vite preview` has the **same** proxy, and it
must keep it — see the worker trap below.

Run `npm run checks` before claiming anything is done. It is what `npm version` gates on.

## Traps that have already cost real time

**`tsc` does not typecheck `.svelte` files.** `npm run typecheck` therefore also runs
`svelte-check`. Without it you can delete a field from a state type, leave components
reading it, and still get a clean typecheck. Never treat `tsc --noEmit` alone as proof.

**maplibre-gl v6 loads its worker from a URL it computes at runtime** from its own
script URL. Rollup cannot see that reference, so the worker is never emitted, and a
server with an SPA fallback answers the request with `index.html` and a **200** — no
404, no console error. The map draws its controls and never renders anything else.
The fix is already in `Map.svelte` (`?worker&url` + `setWorkerUrl`) plus
`worker.format: "es"` in the vite config. `scripts/verify-build.mjs` asserts a worker
ships whenever maplibre is bundled; keep that check working. In dev, maplibre also
needs `optimizeDeps.exclude` or the map comes up empty.

**`$state` proxies the object you hand it — it does not copy.** Handing a module-level
default object to `$state` means "restore defaults" hands back the already-mutated
object. Pass `structuredClone(defaults)` in both the initializer and the reset path.

**v8 coverage loses vite-transformed files.** Coverage uses the istanbul provider
deliberately; switching it back will silently under-report.

**`ky` is pinned on purpose.** 2.x raises the Node floor. Do not let a dep sweep
unpin it. CI runs Node 20, 22 and 24.

**The tracks api carries no timestamps** — just bare `[lon, lat]` pairs — and the
tracks plugin's configured `resolution` is only a _floor_, not the real interval. A
point is added when a position arrives _and_ the resolution has elapsed; AIS reporting
rates vary with a ship's speed and manoeuvring, and reception is lossy, so the true
interval runs longer than configured, differs per vessel, and differs within one track
wherever reception dropped. Measured on a live server: configured 5 s, actually ~10 s,
retaining ~5 hours rather than the configured 10 minutes. Installs set resolution
anywhere from 1 s to several minutes.

So **do not derive time from the data**. Inferring the interval from distance over SOG
was tried and removed: it rested on an estimate the data cannot support, and it went
wrong for exactly the vessels that matter, since a target's speed now says nothing about
its speed when the older part of its track was laid down. Trail dots are spaced in
_screen_ space instead (a dash pattern), and the `TRAIL_LENGTH` window takes its point
count straight from the configured resolution — which, being a floor, errs long and so
never trims data inside the window. Anything needing true time spacing, or the time
marks the standard permits on own ship, needs timestamps added upstream.

## Conventions

- **Track history comes from the shared `@signalk/tracks-plugin`**
  (`GET /signalk/v1/api/tracks`), never from a private client-side buffer — other
  Signal K consumers benefit from fixes made there. Data is oldest-first. Its
  retention is tuned for other consumers, so window it locally (`TRAIL_LENGTH`).
- **All tuning knobs go in `src/engine/constants.ts`**, not inline at the use site.
- **Colors come from `COLOR_MAP`** in that same file.
- **localStorage keys are namespaced** with the plugin id via `src/app/utils/storage.ts`
  (`getStored`/`setStored`). Signal K webapps share an origin, so unprefixed keys
  collide with the server admin UI and other webapps. Validate anything read back —
  persisted values are attacker-or-past-you controlled and may be garbage.
- **Presentation follows IMO SN.1/Circ.243/Rev.2** (linked in `notes/STANDARDS.md`):
  own-ship past track is a thick line, target past positions are "dots, equally spaced
  by time". Check the standard before changing symbology. The one knowing deviation is
  that the dots are spaced evenly on screen rather than in time, because the tracks api
  gives us no timestamps to space them by — see the trap above.
- Reactive state modules use the `.svelte.ts` suffix (`map.svelte.ts`, `ui.svelte.ts`).
- Pull logic out of `.svelte` components into plain `.ts` when it needs testing —
  `src/app/utils/trails.ts` exists for exactly that reason.

## The priority sort key

`calcAlarms()` in `src/engine/calculations.ts` produces `order`, ascending = higher
priority. Targets land in a **band** by severity (danger / warning / closing / opening),
then get ordered _within_ the band by tie breakers on tcpa, cpa and range.

Every tie breaker must stay well inside one band width. They were once unbounded, and
range alone reached a whole band at 100 NM — which sorted an AIS-SART 150 NM out below
a routine collision warning 1 NM away. If you add a tie breaker, clamp it and keep the
sum under a band. `order` also feeds maplibre's `symbol-sort-key` as `999999 - order`,
so it must stay under 999999.

## Notes worth reading

`notes/` holds working research: `protomaps.md`, `esm-vs-cjs.md`,
`map-signalk-to-vesper-data-model.md`, `update-npm-deps.md`, `PUBLISHING.md`, and
sample Signal K payloads (`sample-delta.json`, `sample-streaming.json`,
`sample-bootstrap.json`) that are handy for understanding the ingestion path.

## Housekeeping

- Ask before committing.
- Deployment to the boat Pi is by rsync of `plugin/` and `public/`, not npm publish.
  `--delete` must stay scoped inside those two directories, and `public/` syncs must
  `--exclude 'assets/protomaps'` (the font pack is downloaded server-side and is absent
  from a local build).
