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

// A conventional-commit prefix: type, optional (scope), colon, description.
const PREFIX_PATTERN = /^([a-zA-Z]+)(\([^)]*\))?:\s*(.+)$/;

const KNOWN_TYPES = [
  "feat",
  "fix",
  "refactor",
  "docs",
  "perf",
  "chore",
  "ci",
  "test",
  "build",
];

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

// The subject line always produces an entry, so a commit can never go missing - even
// if its subject carries no recognised prefix, in which case it lands in Other.
//
// Body lines only produce an entry when they carry a recognised prefix. That keeps the
// habit of bundling several conventional-commit lines into one message working, while
// discarding ordinary explanatory prose. Collecting unprefixed body lines too, as this
// once did, turned a handful of commits with written-out reasoning into hundreds of
// sentence fragments in Other.
const entries = [];
for (const { hash, body } of commits) {
  const [subject, ...rest] = body.split("\n");

  const subjectMatch = subject.trim().match(PREFIX_PATTERN);
  if (subjectMatch) {
    const [, rawType, , description] = subjectMatch;
    entries.push({ type: resolveType(rawType), description, hash });
  } else if (subject.trim()) {
    entries.push({ type: null, description: subject.trim(), hash });
  }

  for (const line of rest) {
    const match = line.trim().match(PREFIX_PATTERN);
    if (!match) continue;
    const [, rawType, , description] = match;
    const type = resolveType(rawType);
    if (type) entries.push({ type, description, hash });
  }
}

function section(title, type) {
  const matches = entries.filter((e) => e.type === type);
  if (matches.length === 0) return "";

  const body = matches.map((e) => `- ${e.description} (${e.hash})`).join("\n");

  return `### ${title}\n\n${body}\n\n`;
}

let changelogEntry = `## [${version}] - ${date}\n\n`;
changelogEntry += section("✨ Features", "feat");
changelogEntry += section("🐛 Fixes", "fix");
changelogEntry += section("♻️ Refactors", "refactor");
changelogEntry += section("📝 Docs", "docs");
changelogEntry += section("⚡ Performance", "perf");
changelogEntry += section("🧪 Tests", "test");
changelogEntry += section("🧹 Chores", "chore");
changelogEntry += section("🔧 CI", "ci");
changelogEntry += section("🏗️ Build", "build");

const other = entries.filter((e) => !e.type || !KNOWN_TYPES.includes(e.type));
if (other.length > 0) {
  const body = other.map((e) => `- ${e.description} (${e.hash})`).join("\n");
  // blank line after the heading, to match section() - without it prettier rewrites
  // the file and the next format:check fails on a changelog nobody hand-edited
  changelogEntry += `### 📦 Other\n\n${body}\n\n`;
}

const changelogPath = join(__dirname, "../CHANGELOG.md");
const existing = existsSync(changelogPath)
  ? readFileSync(changelogPath, "utf-8")
  : "";

const TITLE = "# Changelog";
const hasTitle = existing.trim().startsWith(TITLE);

const body = hasTitle
  ? existing.slice(existing.indexOf(TITLE) + TITLE.length).replace(/^\s+/, "")
  : existing;

writeFileSync(changelogPath, `${TITLE}\n\n${changelogEntry}${body}`);

run("git add CHANGELOG.md");
