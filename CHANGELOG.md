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
