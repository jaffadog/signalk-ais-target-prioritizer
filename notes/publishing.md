# Publishing

### Sync repo

    git status               # check for outbound changes
    git pull --rebase        # pull latest, rebase any local commits

### Update dependencies

    npx npm-check-updates    # dry run — review majors carefully
    npx npm-check-updates -u --target minor && npm install   # apply minor/patch only
    # for major bumps, apply deliberately one at a time and re-test

### Checks

    npm run format:check
    npm run lint
    npm run typecheck
    npm run test
    npm run build

### Commit:

Commit all pending changes with appropriate comments. Prefix each line as appropriate (multiple prefixed lines in one commit message are fine — the changelog generator parses each line independently). e.g.:

- **feat** — `feat: add dark mode toggle to settings panel`
- **fix** — `fix: prevent crash when MMSI is null`
- **refactor** — `refactor: extract style builders into separate module`
- **docs** — `docs: update README with PMTiles setup instructions`
- **perf** — `perf: debounce vessel position updates to reduce re-renders`
- **chore** — `chore: bump rollup to v4.62`
- **ci** — `ci: add changelog generation to release workflow`

### Increment version

`npm version` bumps the version in [package.json](../package.json), runs the `version` hook (regenerates `CHANGELOG.md` and stages it), commits everything together, and creates a matching git tag:

    npm version patch   # major | minor | patch

Push the commit and tag:

    git push origin main --follow-tags

### Verify

GH Actions will fire and:

- Create a GH Release using the relevant section of `CHANGELOG.md`
- Publish the release to npm

Confirm both succeeded:

- Check the Actions tab for a green run
- Check https://www.npmjs.com/package/signalk-ais-target-prioritizer shows the new version

### For prerelease/beta:

    npm version prerelease --preid=beta
    git push --follow-tags

### or specify the version explicitly:

    npm version 1.19.0-beta.2
