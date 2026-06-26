# v0.4.14 - 2026-06-26

### ✨ Features
- add support for raster, mbtiles, vector sk chart plugin types (46d0278)

### 🐛 Fixes
- hide un/mute button when showing own vessel properties (034feca)
- retain vessel table sort order (8077233)
- my vessel name and a few other attr not loading (ec4b1ab)
- not all custom maps loading (7622fc7)

### ♻️ Refactors
- basemap selection (a834737)
- basemap resolution (5cd3d62)
- how custom layers and sources are loaded (46d0278)
- how map style is generated (46d0278)

### 📝 Docs
- update README map layers functionality (512ae92)

### 🧹 Chores
- modify publishing process (32b4212)
- move map components out of engine if they are not actually used by plugin (46d0278)
- clean up build and project struture (197fd6d)
- update CHANGELOG.md for v0.4.13 (ce5172e)

### 🔧 CI
- testing against older node/sk versions (cca1fe9)
- testing against older node/sk versions (3cae6f8)
- testing against older node/sk versions (ee10362)
- testing against older node/sk versions (fd72976)
- testing against older node/sk versions (93706f9)
- testing against older node/sk versions (8dccddf)
- testing against older node/sk versions (b5437c1)
- testing against older node/sk versions (020a793)
- testing against older node/sk versions (c68517f)
- testing against older node/sk versions (5c40c02)
- testing against older node/sk versions (5295bee)
- bake in build checks (5cd3d62)

### 📦 Other
- clean up CHANGELOG (e979f76)

## v0.4.13 - 2026-06-23

### 🧹 Chores

- update CHANGELOG.md for v0.4.12 (e886661)

### 📦 Other

- 0.4.13 (e0d06b9)
- test: add sk v2.13.5 to the sk-ci tests. this is a cjs-only (no esm) version. (232ca18)

## v0.4.12 - 2026-06-23

### 🐛 Fixes

- vessel name when sk name and mmsi are still null
- remove sound when rsolving sk alarm notifications

### 🧹 Chores

- update CHANGELOG.md for v0.4.11 (7256a75)

### 📦 Other

- 0.4.12 (51a5a3f)
- clean up CHANGELOG (a1fc0d5)
- test: stub initial test framework (f2bfd53)

## v0.4.11

### 🧹 Chores

- setting up GH actions (9559e56)
- switch vessel leying from MMSI to Context/URN (701d82d)

### 📦 Other

- 0.4.11 (a6784df)

## v0.4.7

Add GH Actions npm publishing pipeline.

## v0.4.6

Add GH Actions npm publishing pipeline.

## v0.4.0

### Major Rewrite

Complete rewrite from vanilla JS + Leaflet to **Svelte 5** + **MapLibre GL JS**.

### New Features

- Switch between **North-up** and **Course-up** map orientation.
- Offline-first basemap support via Protomaps PMTiles, with optional downloadable map labels (fonts/sprites) for SignalK servers with internet access
- Connectivity detection — automatically switches to offline-capable basemaps and disables internet-dependent layers when no connection is available
- Three-way theme mode: Light / Dark / System, with live OS theme change detection
- New loading screen showing real-time initialization progress (auth, connectivity, basemaps, collision profiles, fonts)
- Authentication check on load with friendly login prompt for secured SignalK servers

### Vesper XB-8000 Emulator Removed

With the switch to **MapLibre GL JS** and the introduction of support for **course-up**, the webapp now incorporates all of the functionality of the **Vesper WatchMate** mobile apps - and more. Moving forward, this application will be less complicated to maintain by removing the Vesper XB-8000 emulator. If you are a previous user of the emulator and find some feature missing, please reach out or file an [issue](https://github.com/jaffadog/signalk-ais-target-prioritizer/issues).

### Technical

- Migrated to TypeScript throughout with strict mode enabled
- Dual build pipeline: Vite for the browser SPA, Rollup for the SignalK plugin bundle
- MapLibre GL JS replaces Leaflet — vector tile rendering, smoother performance, full style theming
- Skeleton UI (Cerberus theme) + Tailwind CSS v4 for the interface
