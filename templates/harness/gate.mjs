#!/usr/bin/env node
//
// Harness gate: blocks changes to guarded paths (production code and tests)
// until the active harness run has settled every pre-code stage of its mode.
// See actions/harness.md. No dependencies beyond Node.js 20.
//
// Usage:
//   node harness/gate.mjs                  # Claude Code PreToolUse hook (reads JSON on stdin)
//   node harness/gate.mjs status           # print the active run and what is pending
//   node harness/gate.mjs check [paths...] # fail when a path is guarded and the run is not ready
//                                          # (default paths: files staged in git)
//
// The Skills Code Kit MCP server imports loadConfig, statePath, stageProblem,
// and evaluateRun, so the readiness rules live only here.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BLOCKED = 2; // Exit code Claude Code treats as "block this tool call".
const gateFile = fileURLToPath(import.meta.url);
const gateDirectory = path.dirname(gateFile);
// The gate is installed at <project>/harness/gate.mjs.
export const projectDirectory = path.resolve(gateDirectory, "..");

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

export function loadConfig() {
  return readJson(path.join(gateDirectory, "config.json"));
}

export function statePath(config) {
  return path.resolve(projectDirectory, config.state ?? "docs/harness/active.json");
}

// Converts a glob with *, ** and ? into an anchored regular expression.
function globToRegExp(glob) {
  let pattern = "";

  for (let i = 0; i < glob.length; i += 1) {
    const char = glob[i];

    if (char === "*" && glob[i + 1] === "*") {
      const followedBySlash = glob[i + 2] === "/";
      pattern += followedBySlash ? "(?:.*/)?" : ".*";
      i += followedBySlash ? 2 : 1;
    } else if (char === "*") {
      pattern += "[^/]*";
    } else if (char === "?") {
      pattern += "[^/]";
    } else {
      pattern += char.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }

  return new RegExp(`^${pattern}$`);
}

function matchesAny(relativePath, globs) {
  return globs.some((glob) => globToRegExp(glob).test(relativePath));
}

// Resolves symlinks in the part of the path that exists, so a project opened
// through a symlink (macOS /var and /tmp, for one) still matches.
function realPath(filePath) {
  let existing = path.resolve(projectDirectory, filePath);
  const missing = [];

  while (!existsSync(existing)) {
    const parent = path.dirname(existing);
    if (parent === existing) break;
    missing.unshift(path.basename(existing));
    existing = parent;
  }

  return path.join(realpathSync(existing), ...missing);
}

// Returns the path relative to the project, or null when it lies outside it.
function projectRelative(filePath) {
  const relative = path.relative(realpathSync(projectDirectory), realPath(filePath));
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return relative.split(path.sep).join("/");
}

function isGuarded(config, filePath) {
  const relative = projectRelative(filePath);
  if (relative === null) return false;
  return matchesAny(relative, config.guarded ?? []) && !matchesAny(relative, config.unguarded ?? []);
}

// Returns why a stage is not settled, or null when it is.
export function stageProblem(stage, value, record) {
  if (typeof value !== "string" || value.trim() === "" || value === "pending") {
    return `${stage}: pending`;
  }
  if (/^(skipped|n\/a)\s*:?\s*$/i.test(value)) {
    return `${stage}: "${value}" needs a reason ("skipped: <reason>")`;
  }
  if (value === "done") {
    if (record && !existsSync(path.resolve(projectDirectory, record))) {
      return `${stage}: done, but its record ${record} does not exist`;
    }
    return null;
  }
  if (/^(skipped|n\/a)\s*:/i.test(value)) return null;
  return `${stage}: unknown status "${value}" (use pending, done, skipped: <reason>, n/a: <reason>)`;
}

// Returns { ready, summary, problems } for the active run.
export function evaluateRun(config) {
  const activeRun = statePath(config);

  if (!existsSync(activeRun)) {
    return { ready: false, summary: "No active harness run.", problems: ["open a run with actions/harness.md"] };
  }

  let state;
  try {
    state = readJson(activeRun);
  } catch (error) {
    return { ready: false, summary: `Cannot read ${config.state}.`, problems: [error.message] };
  }

  const required = config.modes?.[state.mode];
  if (!Array.isArray(required)) {
    const modes = Object.keys(config.modes ?? {}).join(", ");
    return { ready: false, summary: `Run mode "${state.mode}" is not defined.`, problems: [`use one of: ${modes}`] };
  }

  const problems = required
    .map((stage) => stageProblem(stage, state.stages?.[stage], state.records?.[stage]))
    .filter(Boolean);

  return {
    ready: problems.length === 0,
    summary: `Run ${state.run ?? "(no run record)"} — mode ${state.mode}.`,
    problems,
  };
}

function blockMessage(files, run) {
  return [
    `Harness gate: ${files.join(", ")} is guarded code, and the run is not ready.`,
    run.summary,
    ...run.problems.map((problem) => `  - ${problem}`),
    "Settle the pre-code stages by following actions/harness.md, then retry.",
    "Do not edit docs/harness/active.json to get past the gate; ask the user if the gate is wrong.",
  ].join("\n");
}

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function stagedFiles() {
  const output = execFileSync("git", ["diff", "--cached", "--name-only"], {
    cwd: projectDirectory,
    encoding: "utf8",
  });
  return output.split("\n").filter(Boolean);
}

function runHook(config) {
  let input;
  try {
    input = JSON.parse(readStdin() || "{}");
  } catch {
    return 0; // Not a hook payload; let the normal permission flow apply.
  }

  const target = input.tool_input?.file_path ?? input.tool_input?.notebook_path;
  if (typeof target !== "string" || !isGuarded(config, target)) return 0;

  const run = evaluateRun(config);
  if (run.ready) return 0;

  console.error(blockMessage([projectRelative(target)], run));
  return BLOCKED;
}

function runStatus(config) {
  const run = evaluateRun(config);
  console.log(run.summary);
  console.log(run.ready ? "Ready: guarded code may change." : "Not ready:");
  for (const problem of run.problems) console.log(`  - ${problem}`);
  return run.ready ? 0 : 1;
}

function runCheck(config, paths) {
  const files = (paths.length > 0 ? paths : stagedFiles()).filter((file) => isGuarded(config, file));
  if (files.length === 0) return 0;

  const run = evaluateRun(config);
  if (run.ready) return 0;

  console.error(blockMessage(files, run));
  return 1;
}

function main() {
  const [command, ...args] = process.argv.slice(2);
  const config = loadConfig();
  const enforced = config.enforce !== false && process.env.HARNESS_GATE !== "off";

  if (command === "status") return runStatus(config);
  if (!enforced) return 0;
  if (command === "check") return runCheck(config, args);
  return runHook(config);
}

// Node resolves symlinks in import.meta.url, so compare real paths.
function isEntryPoint() {
  try {
    return process.argv[1] !== undefined && realpathSync(process.argv[1]) === realpathSync(gateFile);
  } catch {
    return false;
  }
}

const runDirectly = isEntryPoint();

if (runDirectly) {
  try {
    process.exitCode = main();
  } catch (error) {
    // A broken gate must not silently allow or block everything: report it.
    console.error(`Harness gate failed: ${error.message}`);
    process.exitCode = 1;
  }
}
