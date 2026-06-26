// scripts/generate-changelog.mjs
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(join(__dirname, "../package.json"), "utf-8"),
);

const version = pkg.version;
const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

function run(cmd) {
  return execSync(cmd, { encoding: "utf-8", maxBuffer: 1024 * 1024 * 10 });
}

const tags = run("git tag --sort=-creatordate")
  .trim()
  .split("\n")
  .filter(Boolean);
const prevTag = tags[0]; // current HEAD has no tag yet at this point
const range = prevTag ? `${prevTag}..HEAD` : "HEAD";

// Use unlikely-to-collide separators: \x1f between hash and body,
// \x1e between commits. %B captures the FULL multi-line commit message
// (subject + body), not just the subject line.
const RECORD_SEP = "\x1e";
const FIELD_SEP = "\x1f";
const raw = run(
  `git log ${range} --no-merges --pretty=format:"%h${FIELD_SEP}%B${RECORD_SEP}"`,
);

const commits = raw
  .split(RECORD_SEP)
  .map((c) => c.trim())
  .filter(Boolean)
  .map((c) => {
    const [hash, ...bodyParts] = c.split(FIELD_SEP);
    return { hash, body: bodyParts.join(FIELD_SEP) };
  });

// Flatten: every line of every commit body becomes its own entry,
// tagged with that commit's hash. This matches the habit of bundling
// multiple conventional-commit-style lines into one commit message.
const PREFIX_PATTERN = /^([a-zA-Z]+)(\([^)]*\))?:\s*(.+)$/;

const KNOWN_TYPES = ["feat", "fix", "refactor", "docs", "perf", "chore", "ci"];

// Minimal edit-distance check, so typos like "refector" still match "refactor".
// Only corrects typos within a known type, never invents matches across types.
function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) =>
      i === 0 ? j : j === 0 ? i : 0,
    ),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

function resolveType(rawType) {
  const lower = rawType.toLowerCase();
  if (KNOWN_TYPES.includes(lower)) return lower;

  // typo tolerance proportional to word length (short words get less slack)
  let best = null;
  let bestDist = Infinity;
  for (const knownType of KNOWN_TYPES) {
    const dist = levenshtein(lower, knownType);
    const maxAllowed = knownType.length <= 4 ? 1 : 2;
    if (dist <= maxAllowed && dist < bestDist) {
      best = knownType;
      bestDist = dist;
    }
  }
  return best; // null if nothing close enough -> falls through to Other
}

const entries = [];
for (const { hash, body } of commits) {
  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(PREFIX_PATTERN);
    if (match) {
      const [, rawType, , description] = match;
      const type = resolveType(rawType);
      entries.push({ type, description, hash });
    } else {
      entries.push({ type: null, description: trimmed, hash });
    }
  }
}

function section(title, type) {
  const matches = entries.filter((e) => e.type === type);
  if (matches.length === 0) return "";

  const body = matches.map((e) => `- ${e.description} (${e.hash})`).join("\n");

  return `### ${title}\n${body}\n\n`;
}

let changelogEntry = `# v${version} - ${date}\n\n`;
changelogEntry += section("✨ Features", "feat");
changelogEntry += section("🐛 Fixes", "fix");
changelogEntry += section("♻️ Refactors", "refactor");
changelogEntry += section("📝 Docs", "docs");
changelogEntry += section("⚡ Performance", "perf");
changelogEntry += section("🧹 Chores", "chore");
changelogEntry += section("🔧 CI", "ci");

const other = entries.filter((e) => !e.type || !KNOWN_TYPES.includes(e.type));
if (other.length > 0) {
  const body = other.map((e) => `- ${e.description} (${e.hash})`).join("\n");
  changelogEntry += `### 📦 Other\n${body}\n\n`;
}

const changelogPath = join(__dirname, "../CHANGELOG.md");
const existing = existsSync(changelogPath)
  ? readFileSync(changelogPath, "utf-8")
  : "";

writeFileSync(changelogPath, changelogEntry + existing);

run("git add CHANGELOG.md");
