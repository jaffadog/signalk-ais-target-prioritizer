# Publishing

### Update dependencies:

    npx npm-check-updates   # dry run
    npx npm-check-updates -u && npm install

### Checks:

    git status              # check for outbound changes
    git pull                # check for inbound changes
    npm run format          # check formatting
    npm run build           # check builds

### Edit [CHANGELOG.md](../CHANGELOG.md)

Add a new section corresponding to the new version number. Then stage it and any other pending changes with:

    git add -A
    git commit -m "chore: prepare release"

### Increment Version

Increment npm version ([package.json](../package.json) version). Then push changes:

    npm version patch   # major | minor | patch
    git push origin main --follow-tags

and GH Actions will take care of the rest.

### For prerelease/beta:

    npm version prerelease --preid=beta
    git push --follow-tags

### or specify the version explicitly:

    npm version 1.19.0-beta.2
