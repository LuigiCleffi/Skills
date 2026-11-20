#!/usr/bin/env node
//
// Kit update notice: at the start of a Claude Code session, says when a newer
// skills-code-kit is out than the one this project installed, with the
// command that updates the same groups. The moment that matters is before
// someone asks for the first thing, not a weekly reminder nobody reads.
//
// Three rules keep a session hook tolerable:
// - It never breaks the session: offline, no npm, no lock, it says nothing.
// - It never downloads or installs anything: it tells; the person decides.
// - It asks npm at most once every 8 hours per project (a cache in the
//   system's temporary folder).
//
// Usage: node tools/kit-update.mjs           (SessionStart hook; prints JSON for the agent)
//        node tools/kit-update.mjs --check   (prints a line for a person; ignores the cache)

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptFile = fileURLToPath(import.meta.url);
const projectDirectory = path.resolve(path.dirname(scriptFile), "..");
const eightHours = 8 * 60 * 60 * 1000;

// -1, 0, or 1, comparing dotted numeric versions; pre-release tags count as older.
export function compareVersions(a, b) {
  const parse = (version) => String(version).split("-")[0].split(".").map((part) => Number(part) || 0);
  const [x, y] = [parse(a), parse(b)];
  for (let index = 0; index < Math.max(x.length, y.length); index += 1) {
    if ((x[index] ?? 0) !== (y[index] ?? 0)) return (x[index] ?? 0) < (y[index] ?? 0) ? -1 : 1;
  }
  const preA = String(a).includes("-");
  const preB = String(b).includes("-");
  return preA === preB ? 0 : preA ? -1 : 1;
}

export function updateMessage(installed, latest, groups = []) {
  if (!installed || !latest || compareVersions(installed, latest) >= 0) return null;
  const command = groups.length
    ? `npx skills-code-kit@${latest} install --groups ${groups.join(",")} --yes`
    : `npx skills-code-kit@${latest}`;
  return `skills-code-kit ${latest} is out; this project has ${installed}. Tell the user once, and update only if they want: ${command} (files edited since the last install are kept; \`npx skills-code-kit verify\` shows them).`;
}

function readLock() {
  return JSON.parse(readFileSync(path.join(projectDirectory, ".skills-code-kit", "lock.json"), "utf8"));
}

function cacheFile() {
  const key = createHash("sha256").update(projectDirectory).digest("hex").slice(0, 16);
  return path.join(os.tmpdir(), "skills-code-kit-update", `${key}.json`);
}

function latestVersion(useCache) {
  const file = cacheFile();
  if (useCache) {
    try {
      const cached = JSON.parse(readFileSync(file, "utf8"));
      if (Date.now() - cached.at < eightHours) return cached.latest;
    } catch {}
  }
  const latest = execFileSync("npm", ["view", "skills-code-kit", "version"], { encoding: "utf8", timeout: 5000, stdio: ["ignore", "pipe", "ignore"] }).trim();
  try {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify({ at: Date.now(), latest }));
  } catch {}
  return latest;
}

function main() {
  const check = process.argv.includes("--check");
  const lock = readLock();
  const message = updateMessage(lock.version, latestVersion(!check), lock.groups ?? []);
  if (check) {
    console.log(message ?? `skills-code-kit ${lock.version} is the latest.`);
  } else if (message) {
    console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: message } }));
  }
  return 0;
}

function isEntryPoint() {
  try {
    return process.argv[1] !== undefined && realpathSync(process.argv[1]) === realpathSync(scriptFile);
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  try {
    process.exitCode = main();
  } catch {
    // Offline, no npm, no lock: a session hook says nothing and lets the session start.
    process.exitCode = 0;
  }
}
