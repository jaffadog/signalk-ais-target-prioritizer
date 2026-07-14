# v0.4.15 - 2026-07-14

### 🐛 Fixes
- offline worldmap not displaying properly (b402e33)
- dont permit my vessel to be treated as the "selecte3d" vessel for cpa display purposes (adb938a)
- vessels with alarm state and selected vesel icons not being scaled up properly (large size) (adb938a)
- dont rotate aton, base, or sart markers - keep them aligned to the viewport (87051b1)
- online/offline detection not working (00df174)

### ♻️ Refactors
- extend "no gps position" warning from 30 to 60 seconds (72b878f)
- dont calc cpa for targets > 100nm away (6178888)

### 🧹 Chores
- format changelog (13b847e)
- update deps (35b2b93)
- add .ncurc for ky (8ba156d)
- bump the minor-and-patch group across 1 directory with 17 updates (814edca)

### 📦 Other
- Bumps the minor-and-patch group with 16 updates in the / directory: (814edca)
- | Package | From | To | (814edca)
- | --- | --- | --- | (814edca)
- | [@lucide/svelte](https://github.com/lucide-icons/lucide/tree/HEAD/packages/svelte) | `1.21.0` | `1.24.0` | (814edca)
- | [partysocket](https://github.com/cloudflare/partykit/tree/HEAD/packages/partysocket) | `1.2.0` | `1.3.0` | (814edca)
- | [tar](https://github.com/isaacs/node-tar) | `7.5.16` | `7.5.20` | (814edca)
- | [@emnapi/core](https://github.com/toyobayashi/emnapi) | `1.11.1` | `1.11.2` | (814edca)
- | [@emnapi/runtime](https://github.com/toyobayashi/emnapi) | `1.11.1` | `1.11.2` | (814edca)
- | [@signalk/server-api](https://github.com/SignalK/signalk-server/tree/HEAD/packages/server-api) | `2.28.0` | `2.30.0` | (814edca)
- | [@sveltejs/vite-plugin-svelte](https://github.com/sveltejs/vite-plugin-svelte/tree/HEAD/packages/vite-plugin-svelte) | `7.1.2` | `7.2.0` | (814edca)
- | [@tailwindcss/vite](https://github.com/tailwindlabs/tailwindcss/tree/HEAD/packages/@tailwindcss-vite) | `4.3.1` | `4.3.2` | (814edca)
- | [@types/node](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/HEAD/types/node) | `26.0.0` | `26.1.1` | (814edca)
- | [eslint](https://github.com/eslint/eslint) | `10.5.0` | `10.7.0` | (814edca)
- | [eslint-plugin-svelte](https://github.com/sveltejs/eslint-plugin-svelte/tree/HEAD/packages/eslint-plugin-svelte) | `3.19.0` | `3.20.0` | (814edca)
- | [lucide-static](https://github.com/lucide-icons/lucide) | `1.21.0` | `1.24.0` | (814edca)
- | [prettier](https://github.com/prettier/prettier) | `3.8.4` | `3.9.5` | (814edca)
- | [svelte](https://github.com/sveltejs/svelte/tree/HEAD/packages/svelte) | `5.56.3` | `5.56.4` | (814edca)
- | [typescript-eslint](https://github.com/typescript-eslint/typescript-eslint/tree/HEAD/packages/typescript-eslint) | `8.62.0` | `8.63.0` | (814edca)
- | [vite](https://github.com/vitejs/vite/tree/HEAD/packages/vite) | `8.0.16` | `8.1.4` | (814edca)
- Updates `@lucide/svelte` from 1.21.0 to 1.24.0 (814edca)
- - [Release notes](https://github.com/lucide-icons/lucide/releases) (814edca)
- - [Commits](https://github.com/lucide-icons/lucide/commits/1.24.0/packages/svelte) (814edca)
- Updates `partysocket` from 1.2.0 to 1.3.0 (814edca)
- - [Release notes](https://github.com/cloudflare/partykit/releases) (814edca)
- - [Changelog](https://github.com/cloudflare/partykit/blob/main/packages/partysocket/CHANGELOG.md) (814edca)
- - [Commits](https://github.com/cloudflare/partykit/commits/partysocket@1.3.0/packages/partysocket) (814edca)
- Updates `tar` from 7.5.16 to 7.5.20 (814edca)
- - [Release notes](https://github.com/isaacs/node-tar/releases) (814edca)
- - [Changelog](https://github.com/isaacs/node-tar/blob/main/CHANGELOG.md) (814edca)
- - [Commits](https://github.com/isaacs/node-tar/compare/v7.5.16...v7.5.20) (814edca)
- Updates `@emnapi/core` from 1.11.1 to 1.11.2 (814edca)
- - [Release notes](https://github.com/toyobayashi/emnapi/releases) (814edca)
- - [Commits](https://github.com/toyobayashi/emnapi/compare/v1.11.1...v1.11.2) (814edca)
- Updates `@emnapi/runtime` from 1.11.1 to 1.11.2 (814edca)
- - [Release notes](https://github.com/toyobayashi/emnapi/releases) (814edca)
- - [Commits](https://github.com/toyobayashi/emnapi/compare/v1.11.1...v1.11.2) (814edca)
- Updates `@signalk/server-api` from 2.28.0 to 2.30.0 (814edca)
- - [Release notes](https://github.com/SignalK/signalk-server/releases) (814edca)
- - [Changelog](https://github.com/SignalK/signalk-server/blob/master/CHANGELOG.md) (814edca)
- - [Commits](https://github.com/SignalK/signalk-server/commits/v2.30.0/packages/server-api) (814edca)
- Updates `@sveltejs/vite-plugin-svelte` from 7.1.2 to 7.2.0 (814edca)
- - [Release notes](https://github.com/sveltejs/vite-plugin-svelte/releases) (814edca)
- - [Changelog](https://github.com/sveltejs/vite-plugin-svelte/blob/main/packages/vite-plugin-svelte/CHANGELOG.md) (814edca)
- - [Commits](https://github.com/sveltejs/vite-plugin-svelte/commits/@sveltejs/vite-plugin-svelte@7.2.0/packages/vite-plugin-svelte) (814edca)
- Updates `@tailwindcss/vite` from 4.3.1 to 4.3.2 (814edca)
- - [Release notes](https://github.com/tailwindlabs/tailwindcss/releases) (814edca)
- - [Changelog](https://github.com/tailwindlabs/tailwindcss/blob/main/CHANGELOG.md) (814edca)
- - [Commits](https://github.com/tailwindlabs/tailwindcss/commits/v4.3.2/packages/@tailwindcss-vite) (814edca)
- Updates `@types/node` from 26.0.0 to 26.1.1 (814edca)
- - [Release notes](https://github.com/DefinitelyTyped/DefinitelyTyped/releases) (814edca)
- - [Commits](https://github.com/DefinitelyTyped/DefinitelyTyped/commits/HEAD/types/node) (814edca)
- Updates `eslint` from 10.5.0 to 10.7.0 (814edca)
- - [Release notes](https://github.com/eslint/eslint/releases) (814edca)
- - [Commits](https://github.com/eslint/eslint/compare/v10.5.0...v10.7.0) (814edca)
- Updates `eslint-plugin-svelte` from 3.19.0 to 3.20.0 (814edca)
- - [Release notes](https://github.com/sveltejs/eslint-plugin-svelte/releases) (814edca)
- - [Changelog](https://github.com/sveltejs/eslint-plugin-svelte/blob/main/packages/eslint-plugin-svelte/CHANGELOG.md) (814edca)
- - [Commits](https://github.com/sveltejs/eslint-plugin-svelte/commits/eslint-plugin-svelte@3.20.0/packages/eslint-plugin-svelte) (814edca)
- Updates `lucide-static` from 1.21.0 to 1.24.0 (814edca)
- - [Release notes](https://github.com/lucide-icons/lucide/releases) (814edca)
- - [Commits](https://github.com/lucide-icons/lucide/compare/1.21.0...1.24.0) (814edca)
- Updates `prettier` from 3.8.4 to 3.9.5 (814edca)
- - [Release notes](https://github.com/prettier/prettier/releases) (814edca)
- - [Changelog](https://github.com/prettier/prettier/blob/main/CHANGELOG.md) (814edca)
- - [Commits](https://github.com/prettier/prettier/compare/3.8.4...3.9.5) (814edca)
- Updates `svelte` from 5.56.3 to 5.56.4 (814edca)
- - [Release notes](https://github.com/sveltejs/svelte/releases) (814edca)
- - [Changelog](https://github.com/sveltejs/svelte/blob/main/packages/svelte/CHANGELOG.md) (814edca)
- - [Commits](https://github.com/sveltejs/svelte/commits/svelte@5.56.4/packages/svelte) (814edca)
- Updates `tailwindcss` from 4.3.1 to 4.3.2 (814edca)
- - [Release notes](https://github.com/tailwindlabs/tailwindcss/releases) (814edca)
- - [Changelog](https://github.com/tailwindlabs/tailwindcss/blob/main/CHANGELOG.md) (814edca)
- - [Commits](https://github.com/tailwindlabs/tailwindcss/commits/v4.3.2/packages/tailwindcss) (814edca)
- Updates `typescript-eslint` from 8.62.0 to 8.63.0 (814edca)
- - [Release notes](https://github.com/typescript-eslint/typescript-eslint/releases) (814edca)
- - [Changelog](https://github.com/typescript-eslint/typescript-eslint/blob/main/packages/typescript-eslint/CHANGELOG.md) (814edca)
- - [Commits](https://github.com/typescript-eslint/typescript-eslint/commits/v8.63.0/packages/typescript-eslint) (814edca)
- Updates `vite` from 8.0.16 to 8.1.4 (814edca)
- - [Release notes](https://github.com/vitejs/vite/releases) (814edca)
- - [Changelog](https://github.com/vitejs/vite/blob/main/packages/vite/CHANGELOG.md) (814edca)
- - [Commits](https://github.com/vitejs/vite/commits/v8.1.4/packages/vite) (814edca)
- --- (814edca)
- updated-dependencies: (814edca)
- - dependency-name: "@lucide/svelte" (814edca)
- dependency-version: 1.24.0 (814edca)
- dependency-type: direct:production (814edca)
- update-type: version-update:semver-minor (814edca)
- dependency-group: minor-and-patch (814edca)
- - dependency-name: partysocket (814edca)
- dependency-version: 1.3.0 (814edca)
- dependency-type: direct:production (814edca)
- update-type: version-update:semver-minor (814edca)
- dependency-group: minor-and-patch (814edca)
- - dependency-name: tar (814edca)
- dependency-version: 7.5.20 (814edca)
- dependency-type: direct:production (814edca)
- update-type: version-update:semver-patch (814edca)
- dependency-group: minor-and-patch (814edca)
- - dependency-name: "@emnapi/core" (814edca)
- dependency-version: 1.11.2 (814edca)
- dependency-type: direct:development (814edca)
- update-type: version-update:semver-patch (814edca)
- dependency-group: minor-and-patch (814edca)
- - dependency-name: "@emnapi/runtime" (814edca)
- dependency-version: 1.11.2 (814edca)
- dependency-type: direct:development (814edca)
- update-type: version-update:semver-patch (814edca)
- dependency-group: minor-and-patch (814edca)
- - dependency-name: "@signalk/server-api" (814edca)
- dependency-version: 2.30.0 (814edca)
- dependency-type: direct:development (814edca)
- update-type: version-update:semver-minor (814edca)
- dependency-group: minor-and-patch (814edca)
- - dependency-name: "@sveltejs/vite-plugin-svelte" (814edca)
- dependency-version: 7.2.0 (814edca)
- dependency-type: direct:development (814edca)
- update-type: version-update:semver-minor (814edca)
- dependency-group: minor-and-patch (814edca)
- - dependency-name: "@tailwindcss/vite" (814edca)
- dependency-version: 4.3.2 (814edca)
- dependency-type: direct:development (814edca)
- update-type: version-update:semver-patch (814edca)
- dependency-group: minor-and-patch (814edca)
- - dependency-name: "@types/node" (814edca)
- dependency-version: 26.1.1 (814edca)
- dependency-type: direct:development (814edca)
- update-type: version-update:semver-minor (814edca)
- dependency-group: minor-and-patch (814edca)
- - dependency-name: eslint (814edca)
- dependency-version: 10.7.0 (814edca)
- dependency-type: direct:development (814edca)
- update-type: version-update:semver-minor (814edca)
- dependency-group: minor-and-patch (814edca)
- - dependency-name: eslint-plugin-svelte (814edca)
- dependency-version: 3.20.0 (814edca)
- dependency-type: direct:development (814edca)
- update-type: version-update:semver-minor (814edca)
- dependency-group: minor-and-patch (814edca)
- - dependency-name: lucide-static (814edca)
- dependency-version: 1.24.0 (814edca)
- dependency-type: direct:development (814edca)
- update-type: version-update:semver-minor (814edca)
- dependency-group: minor-and-patch (814edca)
- - dependency-name: prettier (814edca)
- dependency-version: 3.9.5 (814edca)
- dependency-type: direct:development (814edca)
- update-type: version-update:semver-minor (814edca)
- dependency-group: minor-and-patch (814edca)
- - dependency-name: svelte (814edca)
- dependency-version: 5.56.4 (814edca)
- dependency-type: direct:development (814edca)
- update-type: version-update:semver-patch (814edca)
- dependency-group: minor-and-patch (814edca)
- - dependency-name: tailwindcss (814edca)
- dependency-version: 4.3.2 (814edca)
- dependency-type: direct:development (814edca)
- update-type: version-update:semver-patch (814edca)
- dependency-group: minor-and-patch (814edca)
- - dependency-name: typescript-eslint (814edca)
- dependency-version: 8.63.0 (814edca)
- dependency-type: direct:development (814edca)
- update-type: version-update:semver-minor (814edca)
- dependency-group: minor-and-patch (814edca)
- - dependency-name: vite (814edca)
- dependency-version: 8.1.4 (814edca)
- dependency-type: direct:development (814edca)
- update-type: version-update:semver-minor (814edca)
- dependency-group: minor-and-patch (814edca)
- ... (814edca)
- Signed-off-by: dependabot[bot] <support@github.com> (814edca)

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
