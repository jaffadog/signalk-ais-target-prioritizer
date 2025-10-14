
Write your package as an ES module.

Install rollup: npm i -D rollup

Run npx rollup index.js --file index.cjs --format cjs to convert your code into a CJS module.

Export both from your package.json:
{
  "name": "my-package",
  "version": "1.0.0",
  "main": "index.js",
  "type": "module",
  "exports": {
    "import": "./index.js",
    "require": "./index.cjs"
  }
}

---

npx rollup index.js --file index.cjs --format cjs to convert your code into a CJS module.


npx rollup index.js --file index.cjs --format cjs

---

rollup.config.js:

import json from "@rollup/plugin-json"

export default defineConfig([
  {
    // ...
    plugins: [json()]
  }
])


