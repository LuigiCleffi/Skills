#!/usr/bin/env node
//
// Harness gate: checks changes to guarded paths (production code and tests)
// against the active harness run, and checks each stage's record before it
// counts as done. See actions/harness.md. No dependencies beyond Node.js 20.
//
// Usage:
//   node harness/gate.mjs                     # Claude Code PreToolUse hook (reads JSON on stdin)
//   node harness/gate.mjs status              # print the active run and what is pending
//   node harness/gate.mjs check [paths...]    # report guarded paths changed before the run is ready
//                                             # (default paths: files staged in git)
//   node harness/gate.mjs validate <stage> <record>
//                                             # check one record against harness/config.json "records"
//   node harness/gate.mjs escapes             # escaped defects per month, from the run records
//
// "enforce" in harness/config.json decides what a problem does:
//   "warn"  (default) the hook tells the agent and the user what is pending and lets the edit through;
//           `check` prints the problems and exits 0.
//   "block" the hook refuses the edit; `check` exits 1.
//   "off"   nothing runs except `status` and `validate`.
// HARNESS_GATE=off|warn|block overrides it for one shell.
//
// A hook that blocks needs irreversible damage on the other side; skipping a
// stage is recoverable, so the default is to warn. A gate that blocks a
// recoverable mistake gets switched off by the first person it stops twice.
//
// The Skills Code Kit MCP server imports loadConfig, statePath, stageProblem,
// requiredStages, and evaluateRun, so the readiness rules live only here.

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BLOCKED = 2; // Exit code Claude Code treats as "block this tool call".
const gateFile = fileURLToPath(import.meta.url);
const gateDirectory = path.dirname(gateFile);
// The gate is installed at <project>/harness/gate.mjs.
export const projectDirectory = path.resolve(gateDirectory, "..");

// Template placeholders that mean a record was never filled in.
const placeholders = ["[FEATURE NAME]"];

// The order stages run in; a run lists its stages in this order.
const stageOrder = [
  "plan",
  "research",
  "spec",
  "spec-checklist",
  "reproduce",
  "strategy",
  "ddd",
  "bdd",
  "uiux",
  "knowledge-gate",
  "adr-gate",
  "tasks",
];

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

export function loadConfig() {
  return readJson(path.join(gateDirectory, "config.json"));
}

export function statePath(config) {
  return path.resolve(projectDirectory, config.state ?? "docs/harness/active.json");
}

// "warn", "block", or "off". Accepts the older true/false values.
export function enforcement(config, environment = process.env) {
  const override = environment.HARNESS_GATE;
  if (override === "off" || override === "warn" || override === "block") return override;
  const value = config.enforce;
  if (value === false || value === "off") return "off";
  if (value === "block" || value === true) return "block";
  return "warn";
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

export function matchesAny(relativePath, globs) {
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

function isGuarded(config, relative) {
  return matchesAny(relative, config.guarded ?? []) && !matchesAny(relative, config.unguarded ?? []);
}

// The triggers whose paths a project-relative file matches.
export function triggersFor(config, relative) {
  return Object.entries(config.triggers ?? {})
    .filter(([, trigger]) => matchesAny(relative, trigger.paths ?? []))
    .map(([name]) => name);
}

// A mode is either a list of stages (older configs) or { stages, triggered }.
function modeDefinition(config, mode) {
  const definition = config.modes?.[mode];
  if (Array.isArray(definition)) return { stages: definition, triggered: [] };
  if (definition && Array.isArray(definition.stages)) {
    return { stages: definition.stages, triggered: definition.triggered ?? [] };
  }
  return null;
}

function inStageOrder(stages) {
  const unique = [...new Set(stages)];
  const rank = (stage) => {
    const index = stageOrder.indexOf(stage);
    return index === -1 ? stageOrder.length + unique.indexOf(stage) : index;
  };
  return unique.sort((a, b) => rank(a) - rank(b));
}

// The pre-code stages a run needs: the mode's stages, plus its triggered
// stages when the run declares at least one trigger. Null for an unknown mode.
export function requiredStages(config, mode, triggers = []) {
  const definition = modeDefinition(config, mode);
  if (!definition) return null;
  return inStageOrder(triggers.length > 0 ? [...definition.stages, ...definition.triggered] : definition.stages);
}

// A record is a file, or a folder of them (feature files, for one): a folder
// is read as all its files together.
function readRecord(file) {
  if (!statSync(file).isDirectory()) return readFileSync(file, "utf8");
  return readdirSync(file, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith("."))
    .map((entry) => readRecord(path.join(file, entry.name)))
    .join("\n");
}

// The document without its fenced code blocks, which hold examples, not the
// record's own content: an example "Open Questions: None." must not settle a
// stage, and an example "| FAIL |" row must not fail one. A fence closes only
// with the same character, at least as long as it opened (CommonMark); an
// unclosed fence runs to the end.
export function withoutFences(document) {
  const kept = [];
  let fence = null;
  for (const line of document.split("\n")) {
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (fence) {
      if (marker && marker[0] === fence[0] && marker.length >= fence.length && line.trim() === marker) fence = null;
      continue;
    }
    if (marker && !(marker[0] === "`" && line.slice(line.indexOf(marker) + marker.length).includes("`"))) {
      fence = marker;
      continue;
    }
    kept.push(line);
  }
  return kept.join("\n");
}

function countWords(document) {
  return document.split(/\s+/).filter(Boolean).length;
}

function hasHeading(document, text) {
  const wanted = text.toLowerCase();
  return document
    .split("\n")
    .some((line) => /^#{1,6}\s/.test(line) && line.toLowerCase().includes(wanted));
}

// Each block that starts with a line matching `pattern` (a task, say) must
// fill every field ("**Verify:** ..."); a field listed in `commands` must hold
// a command in backticks, so the block says how it is proven.
function blockProblems(document, record, rule) {
  const pattern = new RegExp(rule.pattern, "m");
  const lines = document.split("\n");
  const starts = lines.flatMap((line, index) => (pattern.test(line) ? [index] : []));
  if (starts.length === 0) return [`${record} has no block matching ${rule.pattern}`];

  const problems = [];
  starts.forEach((start, n) => {
    const block = lines.slice(start, starts[n + 1] ?? lines.length).join("\n");
    const name = lines[start].replace(/^#+\s*/, "").trim();
    for (const field of rule.fields ?? []) {
      const value = new RegExp(`^\\s*[-*]?\\s*\\*\\*${field}:\\*\\*[ \\t]*(.*)$`, "m").exec(block)?.[1]?.trim();
      if (!value) {
        problems.push(`${name} has no ${field}`);
      } else if ((rule.commands ?? []).includes(field) && !/`[^`]+`/.test(value)) {
        problems.push(`${name}: ${field} needs a command in backticks`);
      }
    }
  });
  return problems;
}

// Checks a record's shape against config.records[stage]: required headings and
// text, forbidden text, blocks with required fields, limits on how often a
// line may repeat, and a word budget. Returns a list of problems.
export function recordProblems(config, stage, record) {
  const file = path.resolve(projectDirectory, record);
  if (!existsSync(file)) return [`its record ${record} does not exist`];

  const rules = config.records?.[stage];
  let document;
  try {
    document = withoutFences(readRecord(file));
  } catch {
    return rules ? [`its record ${record} cannot be read as text`] : [];
  }

  return textProblems(rules, document, record);
}

// The checks of one record's rules against its text (fences already removed).
export function textProblems(rules, document, record) {
  const problems = [];
  for (const placeholder of placeholders) {
    if (document.includes(placeholder)) problems.push(`${record} still has the placeholder ${placeholder}`);
  }
  if (!rules) return problems;

  for (const heading of rules.headings ?? []) {
    if (!hasHeading(document, heading)) problems.push(`${record} has no "${heading}" heading`);
  }
  for (const text of rules.require ?? []) {
    if (!document.includes(text)) problems.push(`${record} does not say "${text}"`);
  }
  for (const text of rules.forbid ?? []) {
    if (document.includes(text)) problems.push(`${record} still contains "${text}"`);
  }
  for (const rule of [rules.blocks].flat().filter(Boolean)) {
    problems.push(...blockProblems(document, record, rule));
  }
  for (const limit of rules.limits ?? []) {
    const count = document.split("\n").filter((line) => new RegExp(limit.pattern).test(line)).length;
    if (count > limit.max) {
      problems.push(`${record} has ${count} lines matching ${limit.pattern}, over ${limit.max}${limit.why ? `: ${limit.why}` : ""}`);
    }
  }
  if (typeof rules.maxWords === "number") {
    const words = countWords(document);
    if (words > rules.maxWords) {
      problems.push(
        `${record} has ${words} words, over the budget of ${rules.maxWords}: split the work or cut repetition (raise "maxWords" only if the user agrees)`,
      );
    }
  }

  return problems;
}

// Returns why a stage is not settled, or null when it is.
export function stageProblem(stage, value, record, config = loadConfig()) {
  if (typeof value !== "string" || value.trim() === "" || value === "pending") {
    return `${stage}: pending`;
  }
  if (/^(skipped|n\/a)\s*:?\s*$/i.test(value)) {
    return `${stage}: "${value}" needs a reason ("skipped: <reason>")`;
  }
  if (value === "done") {
    if (config.records?.[stage] && !record) {
      return `${stage}: done, but it names no record to check`;
    }
    if (!record) return null;
    const problems = recordProblems(config, stage, record);
    return problems.length === 0 ? null : `${stage}: done, but ${problems.join("; ")}`;
  }
  if (/^(skipped|n\/a)\s*:/i.test(value)) return null;
  return `${stage}: unknown status "${value}" (use pending, done, skipped: <reason>, n/a: <reason>)`;
}

function readState(config) {
  const activeRun = statePath(config);
  if (!existsSync(activeRun)) return { state: null, error: null };
  try {
    return { state: readJson(activeRun), error: null };
  } catch (error) {
    return { state: null, error };
  }
}

// Returns { ready, summary, problems } for the active run. With touched paths,
// a trigger those paths hit that the run did not declare is also a problem.
export function evaluateRun(config, touched = []) {
  const { state, error } = readState(config);

  if (error) {
    return { ready: false, summary: `Cannot read ${config.state}.`, problems: [error.message] };
  }
  if (!state) {
    return { ready: false, summary: "No active harness run.", problems: ["open a run with actions/harness.md"] };
  }

  const declared = Array.isArray(state.triggers) ? state.triggers : [];
  const required = requiredStages(config, state.mode, declared);
  if (!required) {
    const modes = Object.keys(config.modes ?? {}).join(", ");
    return { ready: false, summary: `Run mode "${state.mode}" is not defined.`, problems: [`use one of: ${modes}`] };
  }

  const problems = required
    .map((stage) => stageProblem(stage, state.stages?.[stage], state.records?.[stage], config))
    .filter(Boolean);
  if (state.stages?.tasks === "done" && state.records?.tasks) {
    const text = readRecordText(state.records.tasks);
    if (text) problems.push(...taskProblems(parseTasks(text)).map((problem) => `tasks: ${problem}`));
  }

  const undeclared = [...new Set(touched.flatMap((file) => triggersFor(config, file)))].filter(
    (trigger) => !declared.includes(trigger),
  );
  for (const trigger of undeclared) {
    const description = config.triggers?.[trigger]?.description ?? trigger;
    const extra = requiredStages(config, state.mode, [trigger]).filter((stage) => !required.includes(stage));
    problems.push(
      `trigger ${trigger} (${description}) is touched but the run does not declare it` +
        (extra.length > 0 ? `; declaring it adds: ${extra.join(", ")}` : ""),
    );
  }

  const triggerNote = declared.length > 0 ? `, triggers ${declared.join(", ")}` : "";
  return {
    ready: problems.length === 0,
    summary: `Run ${state.run ?? "(no run record)"} — mode ${state.mode}${triggerNote}.`,
    problems,
  };
}

function problemMessage(files, run, level) {
  const lead =
    level === "block"
      ? `Harness gate: ${files.join(", ")} is guarded code, and the run is not ready.`
      : `Harness gate (warning): ${files.join(", ")} is guarded code, and the run is not ready.`;
  return [
    lead,
    run.summary,
    ...run.problems.map((problem) => `  - ${problem}`),
    level === "block"
      ? "Settle the pre-code stages by following actions/harness.md, then retry."
      : "Settle these by following actions/harness.md before going further, or tell the user why this edit cannot wait.",
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

// A warning is shown once per session for the same set of problems, so the
// agent is told without repeating the same lines on every edit.
function firstTimeInSession(sessionId, message) {
  if (typeof sessionId !== "string" || sessionId === "") return true;
  const key = createHash("sha256").update(`${sessionId}\n${message}`).digest("hex").slice(0, 24);
  const directory = path.join(os.tmpdir(), "skills-code-kit-gate");
  try {
    mkdirSync(directory, { recursive: true });
    writeFileSync(path.join(directory, key), "", { flag: "wx" });
    return true;
  } catch (error) {
    return error?.code !== "EEXIST";
  }
}

function runHook(config, level) {
  let input;
  try {
    input = JSON.parse(readStdin() || "{}");
  } catch {
    return 0; // Not a hook payload; let the normal permission flow apply.
  }

  const target = input.tool_input?.file_path ?? input.tool_input?.notebook_path;
  if (typeof target !== "string") return 0;
  const relative = projectRelative(target);
  if (relative === null) return 0;

  const reminders = territoryFor(relative).filter((reminder) => firstTimeInSession(input.session_id, reminder));
  const tell = (context, systemMessage) =>
    console.log(JSON.stringify({ ...(systemMessage ? { systemMessage } : {}), hookSpecificOutput: { hookEventName: "PreToolUse", additionalContext: context } }));

  if (!isGuarded(config, relative)) {
    if (reminders.length > 0) tell(reminders.join("\n"));
    return 0;
  }

  const run = evaluateRun(config, [relative]);
  if (run.ready) {
    if (reminders.length > 0) tell(reminders.join("\n"));
    return 0;
  }

  if (level === "block") {
    console.error(problemMessage([relative], run, "block"));
    return BLOCKED;
  }

  const message = problemMessage([relative], run, "warn");
  if (firstTimeInSession(input.session_id, message)) {
    // additionalContext reaches the model; systemMessage reaches the person.
    tell([message, ...reminders].join("\n"), `Harness gate: ${relative} changed before the run is ready (${run.problems.length} pending).`);
  } else if (reminders.length > 0) {
    tell(reminders.join("\n"));
  }
  return 0;
}

function git(args) {
  try {
    return execFileSync("git", args, { cwd: projectDirectory, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
      .split("\n")
      .filter(Boolean);
  } catch {
    return null;
  }
}

function openedDate(runFile) {
  try {
    return /^\*\*Opened:\*\*\s*(\d{4}-\d{2}-\d{2})/m.exec(readFileSync(path.resolve(projectDirectory, runFile), "utf8"))?.[1] ?? null;
  } catch {
    return null;
  }
}

// What the disk and git say, not what active.json says: guarded files already
// changed, committed or not, since the run opened. Status reads these so a
// stale active.json cannot hide work done before the run was ready.
export function derivedFacts(config) {
  const { state } = readState(config);
  if (!state) return [];
  const facts = [];
  const guarded = (files) => [...new Set(files)].filter((file) => isGuarded(config, file));

  const uncommitted = git(["status", "--porcelain", "--untracked-files=all"]);
  if (uncommitted) {
    const files = guarded(uncommitted.map((line) => line.slice(3).replace(/^.* -> /, "")));
    if (files.length > 0) facts.push(`${files.length} guarded file(s) changed and not committed: ${files.slice(0, 5).join(", ")}${files.length > 5 ? ", ..." : ""}`);
  }

  const since = state.run ? openedDate(state.run) : null;
  if (since) {
    const committed = git(["log", `--since=${since} 00:00`, "--name-only", "--pretty=format:"]);
    if (committed) {
      const files = guarded(committed);
      if (files.length > 0) facts.push(`${files.length} guarded file(s) changed in commits since the run opened on ${since}`);
    }
  }
  return facts;
}

function runStatus(config) {
  const run = evaluateRun(config);
  console.log(run.summary);
  console.log(run.ready ? "Ready: guarded code may change." : "Not ready:");
  for (const problem of run.problems) console.log(`  - ${problem}`);
  const facts = derivedFacts(config);
  if (facts.length > 0) {
    console.log(run.ready ? "From git:" : "From git (code already changed while the run was not ready):");
    for (const fact of facts) console.log(`  - ${fact}`);
  }
  return run.ready ? 0 : 1;
}

// Reads every run record and counts, per month, the fix runs, the escaped
// defects among them, and whether each escaped one added its battery case.
export function escapeReport() {
  const runsDirectory = path.join(projectDirectory, "docs/harness/runs");
  if (!existsSync(runsDirectory)) return [];
  const months = new Map();

  for (const name of readdirSync(runsDirectory).filter((file) => file.endsWith(".md")).sort()) {
    const document = readFileSync(path.join(runsDirectory, name), "utf8");
    const opened = /^\*\*Opened:\*\*\s*(\d{4}-\d{2})/m.exec(document)?.[1];
    if (!opened || !/^\*\*Mode:\*\*\s*Fix/im.test(document)) continue;
    const month = months.get(opened) ?? { month: opened, fixes: 0, escaped: 0, withCase: 0 };
    month.fixes += 1;
    const escaped = /^\*\*Escaped:\*\*\s*yes.*?battery case:\s*(.+)$/im.exec(document);
    if (escaped) {
      month.escaped += 1;
      if (!/^pending/i.test(escaped[1].trim())) month.withCase += 1;
    }
    months.set(opened, month);
  }
  return [...months.values()];
}

function runEscapes() {
  const report = escapeReport();
  if (report.length === 0) {
    console.log("No fix runs recorded in docs/harness/runs/ yet.");
    return 0;
  }
  console.log("| Month | Fix runs | Escaped defects | With a battery case |");
  console.log("|---|---|---|---|");
  for (const row of report) console.log(`| ${row.month} | ${row.fixes} | ${row.escaped} | ${row.withCase} |`);
  return 0;
}

// The paths a record names: anything in backticks that looks like a path.
// A loose scan on purpose: the point is to cover the touched list, and a
// format-exact one would report declared code as foreign.
export function declaredPaths(document) {
  return [...document.matchAll(/`([^`\s]+)`/g)]
    .map((match) => match[1].replace(/^\.\//, "").replace(/[:,;.]+$/, ""))
    .filter((value) => value.includes("/") || /\.[a-z0-9]+$/i.test(value));
}

// The unit "is this ours?" is asked about: the first `depth` folders of a
// path. Per file, the list is too long to read; per module, a stray one shows.
export function moduleOf(file, depth = 2) {
  const parts = file.split("/");
  return parts.length <= depth ? parts.slice(0, -1).join("/") || "." : parts.slice(0, depth).join("/");
}

// Modules the change touched that the run's records never named. A question,
// not a verdict: claim the module in the plan, or move the change to its own
// pull request.
export function undeclaredModules(touched, declared, depth = 2) {
  const claimed = new Set(declared.map((file) => moduleOf(file, depth)));
  const declaredSet = new Set(declared);
  const modules = new Map();
  for (const file of touched) {
    const module = moduleOf(file, depth);
    if (declaredSet.has(file) || claimed.has(module)) continue;
    modules.set(module, [...(modules.get(module) ?? []), file]);
  }
  return [...modules.entries()].map(([module, files]) => ({ module, files }));
}

// Files the records name that the change never touched: a task that may not
// be done. Only guarded files count, so commands, docs, and globs stay out.
export function missingChanges(touched, declared, isCode = () => true) {
  const changed = new Set(touched);
  return [...new Set(declared)].filter(
    (file) => !file.includes("*") && /\.[a-z0-9]+$/i.test(file) && isCode(file) && !changed.has(file),
  );
}

function runScope(config, args) {
  const { state } = readState(config);
  if (!state) {
    console.log("No active harness run; nothing to compare the change with.");
    return 0;
  }
  const baseIndex = args.indexOf("--base");
  const base = baseIndex === -1 ? (config.scope?.base ?? "origin/main") : args[baseIndex + 1];
  const mergeBase = git(["merge-base", base, "HEAD"])?.[0];
  if (!mergeBase) {
    console.error(`Cannot find ${base} to compare with. Fetch it, or pass --base <branch>.`);
    return 1;
  }
  const committed = git(["diff", "--name-only", `${mergeBase}..HEAD`]) ?? [];
  const uncommitted = (git(["status", "--porcelain", "--untracked-files=all"]) ?? []).map((line) => line.slice(3).replace(/^.* -> /, ""));
  const touched = [...new Set([...committed, ...uncommitted])].filter((file) => isGuarded(config, file));

  const records = Object.values(state.records ?? {}).filter(Boolean);
  const declared = records.flatMap((record) => {
    try {
      return declaredPaths(readRecord(path.resolve(projectDirectory, record)));
    } catch {
      return [];
    }
  });

  const depth = config.scope?.depth ?? 2;
  const foreign = undeclaredModules(touched, declared, depth);
  const missing = missingChanges(touched, declared, (file) => isGuarded(config, file));
  console.log(`${touched.length} guarded file(s) changed since ${base}; ${declared.length} path(s) named in the run's records.`);

  if (foreign.length === 0) {
    console.log("UNEXPECTED CHANGE: none. Every touched module is named in the run's records.");
  } else {
    console.log("UNEXPECTED CHANGE: touched but not named in the run's records (is this ours?):");
    for (const { module, files } of foreign) {
      console.log(`  - ${module} (${files.length} file${files.length === 1 ? "" : "s"}: ${files.slice(0, 3).join(", ")}${files.length > 3 ? ", ..." : ""})`);
    }
    console.log("  Claim each one in the plan or tasks record, or move its change to its own pull request.");
  }

  if (missing.length === 0) {
    console.log("MISSING CHANGE: none. Every code file the records name was changed.");
  } else {
    console.log("MISSING CHANGE: named in the run's records but not changed (is a task undone?):");
    for (const file of missing) console.log(`  - ${file}`);
    console.log("  Finish the task, or update the record if the plan changed.");
  }
  return 0;
}

// ── Tasks, coverage, and the board ─────────────────────────────────────────

// The tasks of a tasks record: id, title, files, depends, status. A task is
// a block that starts with a "TASK-n" heading; "**Status:**" is todo, doing,
// done, or blocked (todo when missing).
export function parseTasks(document) {
  const lines = withoutFences(document).split("\n");
  const tasks = [];
  let current = null;
  for (const line of lines) {
    const heading = /^#{2,4}\s+(TASK-\d+)\b\s*(.*)$/.exec(line);
    if (heading) {
      current = { id: heading[1], title: heading[2].trim(), files: [], depends: [], status: "todo" };
      tasks.push(current);
      continue;
    }
    if (!current) continue;
    const field = /^\s*[-*]?\s*\*\*(Files|Depends|Status):\*\*\s*(.*)$/.exec(line);
    if (!field) continue;
    if (field[1] === "Files") current.files = [...field[2].matchAll(/`([^`]+)`(\s*\(new\))?/g)].map((m) => ({ path: m[1], isNew: Boolean(m[2]) }));
    if (field[1] === "Depends") current.depends = [...field[2].matchAll(/TASK-\d+/g)].map((m) => m[0]);
    if (field[1] === "Status") current.status = field[2].trim().toLowerCase().split(/\s/)[0] || "todo";
  }
  return tasks;
}

// The first dependency cycle among the tasks, as a list of ids, or null.
export function dependencyCycle(tasks) {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const state = new Map();
  const stack = [];
  const visit = (id) => {
    if (state.get(id) === "done") return null;
    if (state.get(id) === "open") return [...stack.slice(stack.indexOf(id)), id];
    state.set(id, "open");
    stack.push(id);
    for (const next of byId.get(id)?.depends ?? []) {
      const cycle = byId.has(next) ? visit(next) : null;
      if (cycle) return cycle;
    }
    stack.pop();
    state.set(id, "done");
    return null;
  };
  for (const task of tasks) {
    const cycle = visit(task.id);
    if (cycle) return cycle;
  }
  return null;
}

export function taskProblems(tasks, exists = (file) => existsSync(path.resolve(projectDirectory, file))) {
  const problems = [];
  const ids = new Set(tasks.map((task) => task.id));
  for (const task of tasks) {
    for (const file of task.files) {
      if (!file.isNew && !file.path.includes("*") && !exists(file.path)) {
        problems.push(`${task.id} names ${file.path}, which does not exist; mark it "(new)" if the task creates it`);
      }
    }
    for (const dependency of task.depends) {
      if (!ids.has(dependency)) problems.push(`${task.id} depends on ${dependency}, which is not a task`);
    }
  }
  const cycle = dependencyCycle(tasks);
  if (cycle) problems.push(`the tasks depend on each other in a circle: ${cycle.join(" → ")}`);
  return problems;
}

const emptyEvidence = new Set(["", "-", "—", "–", "ok", "n/a", "na", "tbd", "todo", "?", "yes", "passed"]);

// Every acceptance criterion the spec names has a scenario in the QA report
// citing it, the report cites no criterion the spec lacks, and no passed
// scenario has empty or placeholder evidence. Criterion IDs are found with
// config.coverage.criteria (a regex).
export function coverageProblems(config, specText, qaText) {
  const pattern = new RegExp(config.coverage?.criteria ?? "\\b(?:FR-\\d+|US-\\d+(?: AC-\\d+)?|SC-\\d+)\\b", "g");
  const spec = new Set(withoutFences(specText).match(pattern) ?? []);
  const rows = withoutFences(qaText)
    .split("\n")
    .filter((line) => /^\s*\|/.test(line) && !/^\s*\|[\s|:-]+\|\s*$/.test(line))
    .map((line) => line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim()))
    .filter((cells) => cells.some((cell) => /^(PASS|FAIL|BLOCKED|MANUAL)$/.test(cell)));

  const cited = new Set();
  const problems = [];
  for (const cells of rows) {
    const ids = cells.join(" ").match(pattern) ?? [];
    for (const id of ids) {
      cited.add(id);
      if (!spec.has(id)) problems.push(`${cells[0]} cites ${id}, which the spec does not name`);
    }
    const result = cells.find((cell) => /^(PASS|FAIL|BLOCKED|MANUAL)$/.test(cell));
    const evidence = cells[cells.length - 1];
    if (result === "PASS" && emptyEvidence.has(evidence.toLowerCase())) {
      problems.push(`${cells[0]} passed with no evidence ("${evidence}"): say what was run and what it showed`);
    }
  }
  for (const id of spec) {
    if (!cited.has(id)) problems.push(`${id} has no scenario in the QA report`);
  }
  return problems;
}

function readRecordText(record) {
  try {
    return readRecord(path.resolve(projectDirectory, record));
  } catch {
    return null;
  }
}

// Coverage and task problems of the active run, from its spec, qa, and
// tasks records. Empty when the records are not there yet.
export function runCoverageProblems(config, state) {
  const problems = [];
  const spec = state?.records?.spec ? readRecordText(state.records.spec) : null;
  const qa = state?.records?.qa ? readRecordText(state.records.qa) : null;
  const tasks = state?.records?.tasks ? readRecordText(state.records.tasks) : null;
  if (spec && qa) problems.push(...coverageProblems(config, spec, qa));
  if (tasks) problems.push(...taskProblems(parseTasks(tasks)));
  return problems;
}

function runCoverage(config, args) {
  const { state } = readState(config);
  const [specPath, qaPath, tasksPath] = args;
  const records = specPath ? { spec: specPath, qa: qaPath, tasks: tasksPath } : state?.records ?? {};
  const problems = runCoverageProblems(config, { records });
  if (problems.length === 0) {
    console.log("Coverage: every criterion has a scenario with evidence, and the tasks hold together.");
    return 0;
  }
  console.error("Coverage problems:");
  for (const problem of problems) console.error(`  - ${problem}`);
  return 1;
}

// The tasks by status, and the frontier: tasks not done whose dependencies
// are all done, which can start now.
export function boardOf(tasks) {
  const done = new Set(tasks.filter((task) => task.status === "done").map((task) => task.id));
  const counts = {};
  for (const task of tasks) counts[task.status] = (counts[task.status] ?? 0) + 1;
  const frontier = tasks.filter((task) => task.status !== "done" && task.depends.every((id) => done.has(id)));
  return { counts, frontier, total: tasks.length, done: done.size };
}

function runBoard(config, args) {
  const { state } = readState(config);
  const record = args[0] ?? state?.records?.tasks;
  const text = record ? readRecordText(record) : null;
  if (!text) {
    console.log("No tasks record: pass its path, or record the tasks stage in the run.");
    return 1;
  }
  const board = boardOf(parseTasks(text));
  console.log(`${board.done}/${board.total} tasks done (${Object.entries(board.counts).map(([status, n]) => `${status} ${n}`).join(", ")}).`);
  console.log(board.frontier.length === 0 ? "Nothing can start now." : "Can start now:");
  for (const task of board.frontier) console.log(`  - ${task.id} ${task.title}${task.status !== "todo" ? ` (${task.status})` : ""}`);
  return 0;
}

// ── Brief: the run's state at each prompt ──────────────────────────────────

const stageWorkflows = {
  plan: "ProductDefinition/plan.md",
  research: "actions/research.md",
  spec: "ProductDefinition/specs/spec-definition.md",
  "spec-checklist": "ProductDefinition/specs/spec-checklist.md",
  reproduce: "actions/tdd.md",
  strategy: "actions/strategy.md",
  ddd: "actions/ddd.md",
  bdd: "actions/bdd.md",
  uiux: "actions/uiux.md",
  "knowledge-gate": "actions/knowledge.md",
  "adr-gate": "actions/adr.md",
  tasks: "actions/dev.md (Plan the tasks)",
  dev: "actions/dev.md",
  review: "actions/review.md",
  qa: "actions/qa.md",
  "code-review": "actions/code-review.md",
};

// What the agent needs before it acts on a prompt: the run, the next stage
// and its workflow, and how far the tasks are. Null without an active run.
export function briefOf(config) {
  const { state } = readState(config);
  if (!state) return null;
  const declared = Array.isArray(state.triggers) ? state.triggers : [];
  const stages = [...(requiredStages(config, state.mode, declared) ?? []), ...postCodeStages(config, state.mode)];
  const next = stages.find((stage) => stageProblem(stage, state.stages?.[stage], state.records?.[stage], config) !== null);
  const lines = [`Harness run ${state.run ?? "(no run record)"}: mode ${state.mode}${declared.length ? `, triggers ${declared.join(", ")}` : ""}.`];
  if (next) {
    lines.push(`Next stage: ${next}, following ${stageWorkflows[next] ?? `actions/${next}.md`}. Skipping it loses what that stage checks; record it done or "skipped: <reason>".`);
  } else {
    lines.push("Every stage is settled; close the run with its result (actions/finish.md after the merge).");
  }
  const tasks = state.records?.tasks ? readRecordText(state.records.tasks) : null;
  if (tasks) {
    const board = boardOf(parseTasks(tasks));
    lines.push(`Tasks: ${board.done}/${board.total} done${board.frontier.length ? `; can start: ${board.frontier.map((task) => task.id).join(", ")}` : ""}.`);
  }
  return lines.join("\n");
}

function postCodeStages(config, mode) {
  const all = ["dev", "review", "qa", "code-review"];
  const configured = config.modes?.[mode]?.postCode;
  if (Array.isArray(configured)) return configured;
  return mode === "chore" ? ["dev", "review"] : all;
}

function runBrief(config) {
  let input = {};
  try {
    input = JSON.parse(readStdin() || "{}");
  } catch {}
  try {
    const brief = briefOf(config);
    if (!brief || !firstTimeInSession(input.session_id, brief)) return 0;
    console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: brief } }));
  } catch {
    // A briefing must never stop a prompt.
  }
  return 0;
}

// ── Territory: what to read before writing here ────────────────────────────

// The rows of the knowledge and ADR gates whose "Paths" match a file: before
// writing there, the agent reads what the row points to.
export function territoryFor(relative, gates = ["docs/knowledge/README.md", "docs/adr/README.md"]) {
  const reminders = [];
  for (const gate of gates) {
    const text = readRecordText(gate);
    if (!text) continue;
    let pathsColumn = -1;
    let readColumn = -1;
    for (const line of withoutFences(text).split("\n")) {
      if (!/^\s*\|/.test(line)) continue;
      const cells = line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
      if (cells.includes("Paths")) {
        pathsColumn = cells.indexOf("Paths");
        readColumn = cells.findIndex((cell) => /^(Read|Agent)$/.test(cell));
        continue;
      }
      if (pathsColumn < 0 || /^[\s:-]+$/.test(cells.join(""))) continue;
      const globs = [...(cells[pathsColumn] ?? "").matchAll(/`([^`]+)`/g)].map((m) => m[1]);
      if (globs.length && matchesAny(relative, globs)) {
        const read = (cells[readColumn] ?? "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
        reminders.push(`${relative} is governed by ${gate}: read ${read || "the row's files"} before writing here.`);
      }
    }
  }
  return reminders;
}

// ── Issues: the format of an issue an agent writes ─────────────────────────

// Checks the body of an issue a tool is about to save (any issue-tracker MCP
// whose tool name matches config.issues.tools) against records.issue. It
// warns; it never blocks, since an issue is easy to edit.
export function issueProblems(config, toolName, toolInput) {
  const settings = config.issues ?? {};
  const tools = new RegExp(settings.tools ?? "^mcp__.*__(save_issue|create_issue|update_issue)$");
  if (!tools.test(toolName ?? "")) return [];
  const fields = settings.bodyFields ?? ["description", "body"];
  const body = fields.map((field) => toolInput?.[field]).find((value) => typeof value === "string");
  if (body === undefined) return [];
  return textProblems(config.records?.issue, withoutFences(body), "the issue");
}

function runIssueHook(config) {
  let input;
  try {
    input = JSON.parse(readStdin() || "{}");
  } catch {
    return 0;
  }
  const problems = issueProblems(config, input.tool_name, input.tool_input);
  if (problems.length === 0) return 0;
  const message = `The issue does not follow the project's format (harness/config.json records.issue):\n${problems.map((problem) => `  - ${problem}`).join("\n")}\nFix the body before saving, or save it and fix it next.`;
  console.log(JSON.stringify({
    systemMessage: `Issue format: ${problems.length} problem(s).`,
    hookSpecificOutput: { hookEventName: "PreToolUse", additionalContext: message },
  }));
  return 0;
}

function runCheck(config, level, paths) {
  const files = (paths.length > 0 ? paths : stagedFiles())
    .map((file) => projectRelative(file))
    .filter((file) => file !== null && isGuarded(config, file));
  if (files.length === 0) return 0;

  const run = evaluateRun(config, files);
  if (run.ready) return 0;

  console.error(problemMessage(files, run, level));
  return level === "block" ? 1 : 0;
}

function runValidate(config, [stage, record]) {
  if (!stage || !record) {
    console.error("Usage: node harness/gate.mjs validate <stage> <record>");
    return 1;
  }
  const problems = recordProblems(config, stage, record);
  if (problems.length === 0) {
    console.log(`${record}: ready to count as ${stage} done.`);
    return 0;
  }
  console.error(`${record} is not ready to count as ${stage} done:`);
  for (const problem of problems) console.error(`  - ${problem}`);
  return 1;
}

function main() {
  const [command, ...args] = process.argv.slice(2);
  const config = loadConfig();
  const level = enforcement(config);

  if (command === "status") return runStatus(config);
  if (command === "validate") return runValidate(config, args);
  if (command === "escapes") return runEscapes();
  if (command === "scope") return runScope(config, args);
  if (command === "coverage") return runCoverage(config, args);
  if (command === "board") return runBoard(config, args);
  if (command === "brief") return runBrief(config);
  if (command === "issue") return runIssueHook(config);
  if (level === "off") return 0;
  if (command === "check") return runCheck(config, level, args);
  return runHook(config, level);
}

// Node resolves symlinks in import.meta.url, so compare real paths.
function isEntryPoint() {
  try {
    return process.argv[1] !== undefined && realpathSync(process.argv[1]) === realpathSync(gateFile);
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  try {
    process.exitCode = main();
  } catch (error) {
    // A broken gate must not silently allow or block everything: report it.
    console.error(`Harness gate failed: ${error.message}`);
    process.exitCode = 1;
  }
}
