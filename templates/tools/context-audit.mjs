#!/usr/bin/env node
//
// Context audit: what each agent tool (Claude Code, Codex, OpenCode) loads
// from this project before the first prompt, largest first, against a budget.
// It reads files inside the project only: it never starts an MCP server, runs
// a hook, or fetches a URL.
//
// Usage (from the project root):
//   node tools/context-audit.mjs                 # text report
//   node tools/context-audit.mjs --json          # the same, as JSON
//   node tools/context-audit.mjs --budget 8000   # override tools/context-audit.json for one run
//
// What counts (docs/knowledge rules BR-0001 to BR-0005 in the kit's repository):
//   Claude Code  CLAUDE.md, .claude/CLAUDE.md, CLAUDE.local.md (AGENTS.md only when none
//                exists), their @imports up to four hops, .claude/rules/*.md without
//                `paths`, and skill and agent descriptions (capped at 1,536 characters)
//   Codex        AGENTS.override.md or AGENTS.md, .agents/skills and .codex/agents
//                descriptions; fails when the instructions pass project_doc_max_bytes
//   OpenCode     AGENTS.md (CLAUDE.md when missing), `instructions` files, and skill and
//                agent descriptions
// Instruction files in subfolders load only when the agent works there, so they are
// listed apart and never counted in a total. MCP servers and hooks are named, not counted.
// An unreadable or binary file is left out with a warning.
//
// Tokens: js-tiktoken's o200k_base when the project has it installed (approximate for
// Claude models), else characters divided by four, marked "≈" as an estimate.
//
// Exit codes: 0 within budget; 1 over budget or Codex would drop instructions;
// 2 usage, configuration, or unexpected error (never confused with a result).

import { createRequire } from "node:module";
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const DEFAULT_BUDGET = 10000;
const CODEX_DEFAULT_CAP = 32768;
const CLAUDE_DESCRIPTION_CAP = 1536;
const MAX_IMPORT_HOPS = 4;
const NEVER_SEARCHED = new Set(["node_modules", ".git"]);
const INSTRUCTION_FILES = new Set(["AGENTS.md", "AGENTS.override.md", "CLAUDE.md", "CLAUDE.local.md"]);
const CLAUDE_SETTINGS = [".claude/settings.json", ".claude/settings.local.json"];
const TOOL_NAMES = { "claude-code": "Claude Code", codex: "Codex", opencode: "OpenCode" };
const INSTALL_TOKENIZER = "npm install --save-dev js-tiktoken";
const scriptFile = fileURLToPath(import.meta.url);

class UsageError extends Error {}

const formatNumber = (number) => number.toLocaleString("en-US");

// ── Reading the project ─────────────────────────────────────────────────────

function readText(root, relative) {
  try {
    return readFileSync(path.join(root, relative), "utf8");
  } catch {
    return null;
  }
}

function isDirectory(root, relative) {
  try {
    return statSync(path.join(root, relative)).isDirectory();
  } catch {
    return false;
  }
}

function exists(root, relative) {
  return existsSync(path.join(root, relative));
}

const isOutside = (relative) => relative === ".." || relative.startsWith("../") || path.isAbsolute(relative);

// The text of a file a tool would load, or null with a warning when it cannot be
// read or is binary: such a file is left out rather than counted as empty or as noise.
function readCounted(root, relative, warnings) {
  const text = readText(root, relative);
  if (text === null) warnings.add(`${relative} cannot be read; not counted.`);
  else if (text.includes("\0")) warnings.add(`${relative} is binary; not counted.`);
  else return text;
  return null;
}

function directoryEntries(root, relative, warnings) {
  try {
    return readdirSync(path.join(root, relative), { withFileTypes: true });
  } catch {
    warnings.add(`${relative} cannot be read; its files are not searched.`);
    return [];
  }
}

function listFiles(root, relative, predicate, warnings, recursive = false) {
  if (!isDirectory(root, relative)) return [];
  const found = [];
  for (const entry of directoryEntries(root, relative, warnings)) {
    const child = path.posix.join(relative, entry.name);
    if (entry.isDirectory() && recursive && !NEVER_SEARCHED.has(entry.name)) found.push(...listFiles(root, child, predicate, warnings, true));
    else if (entry.isFile() && predicate(entry.name)) found.push(child);
  }
  return found.sort();
}

// Skill folders hold one SKILL.md each: `<folder>/<name>/SKILL.md`.
function skillFiles(root, folder, warnings) {
  if (!isDirectory(root, folder)) return [];
  return directoryEntries(root, folder, warnings)
    .filter((entry) => entry.isDirectory() && exists(root, path.posix.join(folder, entry.name, "SKILL.md")))
    .map((entry) => path.posix.join(folder, entry.name, "SKILL.md"))
    .sort();
}

// JSON with comments and trailing commas (opencode.jsonc); plain JSON passes through.
function parseJsonc(text) {
  let result = "";
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (character === '"') {
      const end = endOfString(text, index);
      result += text.slice(index, end + 1);
      index = end;
    } else if (character === "/" && text[index + 1] === "/") {
      while (index < text.length && text[index] !== "\n") index++;
      result += "\n";
    } else if (character === "/" && text[index + 1] === "*") {
      index = text.indexOf("*/", index + 2);
      if (index < 0) break;
      index++;
    } else if (character === "," && /^\s*[}\]]/.test(text.slice(index + 1))) {
      continue;
    } else {
      result += character;
    }
  }
  return JSON.parse(result);
}

function endOfString(text, start) {
  for (let index = start + 1; index < text.length; index++) {
    if (text[index] === "\\") index++;
    else if (text[index] === '"') return index;
  }
  return text.length - 1;
}

// Reads a tool's JSON config; a malformed one is a warning, not a failure.
function readConfig(root, relative, warnings) {
  const text = readText(root, relative);
  if (text === null) return null;
  try {
    const config = parseJsonc(text);
    if (config && typeof config === "object") return config;
  } catch {}
  warnings.add(`${relative} is not a valid JSON object; what it configures is not listed.`);
  return null;
}

function frontmatterOf(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  return match ? match[1] : null;
}

// The value of a top-level key in YAML frontmatter: plain, quoted, or a block scalar.
function frontmatterValue(frontmatter, key) {
  const lines = frontmatter.split(/\r?\n/);
  const start = lines.findIndex((line) => line.startsWith(`${key}:`));
  if (start < 0) return null;
  const inline = lines[start].slice(key.length + 1).trim();
  if (/^[>|][-+]?$/.test(inline)) {
    const block = [];
    for (const line of lines.slice(start + 1)) {
      if (line.trim() && !/^\s/.test(line)) break;
      block.push(line.trim());
    }
    return block.join(inline.startsWith(">") ? " " : "\n").trim();
  }
  return inline.replace(/^(["'])([\s\S]*)\1$/, "$2");
}

function tomlString(text, key) {
  const triple = new RegExp(`^${key}\\s*=\\s*("""|''')([\\s\\S]*?)\\1`, "m").exec(text);
  if (triple) return triple[2].trim();
  const single = new RegExp(`^${key}\\s*=\\s*(["'])(.*)\\1\\s*$`, "m").exec(text);
  return single ? single[2] : null;
}

// Name and description of a skill or agent, by file format.
const markdownDescription = (text) => {
  const frontmatter = frontmatterOf(text);
  if (!frontmatter) return { name: null, description: null };
  const description = [frontmatterValue(frontmatter, "description"), frontmatterValue(frontmatter, "when_to_use")].filter(Boolean).join("\n");
  return { name: frontmatterValue(frontmatter, "name"), description };
};
const tomlDescription = (text) => ({ name: tomlString(text, "name"), description: tomlString(text, "description") });

function globToRegExp(glob) {
  let source = "";
  for (let index = 0; index < glob.length; index++) {
    const character = glob[index];
    if (character === "*" && glob[index + 1] === "*") {
      source += glob[index + 2] === "/" ? "(?:.*/)?" : ".*";
      index += glob[index + 2] === "/" ? 2 : 1;
    } else if (character === "*") source += "[^/]*";
    else if (character === "?") source += "[^/]";
    else source += character.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${source}$`);
}

function expandGlob(root, pattern, warnings) {
  if (!/[*?]/.test(pattern)) return exists(root, pattern) ? [pattern] : [];
  const base = pattern.slice(0, pattern.search(/[*?]/)).replace(/[^/]*$/, "").replace(/\/$/, "") || ".";
  const matcher = globToRegExp(pattern);
  return listFiles(root, base, () => true, warnings, true)
    .map((file) => path.posix.normalize(file))
    .filter((file) => matcher.test(file));
}

// ── Counting tokens ─────────────────────────────────────────────────────────

// js-tiktoken from the project when installed (ADR-0001), else a marked estimate.
export async function makeCounter(root) {
  try {
    const require = createRequire(path.join(root, "package.json"));
    const lite = await import(pathToFileURL(require.resolve("js-tiktoken/lite")).href);
    const ranksModule = await import(pathToFileURL(require.resolve("js-tiktoken/ranks/o200k_base")).href);
    const Tiktoken = lite.Tiktoken ?? lite.default?.Tiktoken;
    const ranks = ranksModule.default?.default ?? ranksModule.default;
    const encoder = new Tiktoken(ranks);
    return { method: "o200k_base", count: (text) => encoder.encode(text, [], []).length };
  } catch {
    return { method: "estimate", count: (text) => Math.ceil(text.length / 4) };
  }
}

// ── What each tool loads ────────────────────────────────────────────────────

function detectTools(root) {
  const tools = [];
  if (["CLAUDE.md", "CLAUDE.local.md", ".mcp.json"].some((file) => exists(root, file)) || isDirectory(root, ".claude")) tools.push("claude-code");
  if (isDirectory(root, ".codex") || isDirectory(root, ".agents/skills")) tools.push("codex");
  if (isDirectory(root, ".opencode") || exists(root, "opencode.json") || exists(root, "opencode.jsonc")) tools.push("opencode");
  if (tools.length === 0 && exists(root, "AGENTS.md")) tools.push("codex", "opencode");
  return tools;
}

const stripHtmlComments = (text) => text.replace(/^[ \t]*<!--[\s\S]*?-->[ \t]*\r?\n?/gm, "");
const withoutCode = (text) => text.replace(/^(```|~~~)[\s\S]*?^\1[^\n]*$/gm, "").replace(/`[^`\n]*`/g, "");

function importsOf(text) {
  // A path has a slash or an extension; "@alice" or "@here" is a mention, not an import.
  return [...withoutCode(text).matchAll(/(?:^|\s)@([^\s]+)/g)]
    .map((match) => match[1].replace(/[.,;:)\]]+$/, ""))
    .filter((target) => /[/.]/.test(target));
}

// Counts a Claude Code instruction file and everything it imports, up to four hops.
function claudeInstructions(root, file, context) {
  const queue = [{ file, chain: [file] }];
  while (queue.length) {
    const { file: current, chain } = queue.shift();
    if (context.counted.has(current)) continue;
    context.counted.add(current);
    const text = readCounted(root, current, context.warnings);
    if (text === null) continue;
    context.parts.push({ kind: chain.length === 1 ? "instructions" : "import", path: current, tokens: context.count(stripHtmlComments(text)) });
    for (const target of importsOf(text)) {
      const resolved = target.startsWith("~/") || path.isAbsolute(target) ? null : path.posix.normalize(path.posix.join(path.posix.dirname(current), target));
      if (!resolved || isOutside(resolved)) {
        context.warnings.add(`${target}, imported by ${current}, is outside the project; not counted.`);
      } else if (!exists(root, resolved)) {
        context.warnings.add(`${resolved}, imported by ${current}, does not exist.`);
      } else if (context.counted.has(resolved)) {
        continue;
      } else if (chain.length > MAX_IMPORT_HOPS) {
        context.warnings.add(`${resolved} is not counted: Claude Code follows imports up to four hops (${[...chain, resolved].join(" → ")}).`);
      } else {
        queue.push({ file: resolved, chain: [...chain, resolved] });
      }
    }
  }
}

function countInstructionFile(root, file, context) {
  if (context.counted.has(file)) return null;
  context.counted.add(file);
  const text = readCounted(root, file, context.warnings);
  if (text !== null) context.parts.push({ kind: "instructions", path: file, tokens: context.count(text) });
  return text;
}

function describedPart(root, file, { kind, read, cap = Infinity }, context) {
  const text = readCounted(root, file, context.warnings);
  if (text === null) return;
  let { name, description } = read(text);
  if (!description) {
    context.warnings.add(`${file} has no description, so tools do not list it.`);
    context.parts.push({ kind, path: file, tokens: 0, note: "no description" });
    return;
  }
  const part = { kind, path: file };
  if (description.length > cap) {
    description = description.slice(0, cap);
    part.note = `description capped at ${formatNumber(cap)} characters`;
    context.warnings.add(`${file}: Claude Code lists only the first ${formatNumber(cap)} characters of its description; the rest is never seen.`);
  }
  part.tokens = context.count(`${name ?? path.posix.basename(path.posix.dirname(file))}\n${description}`);
  context.parts.push(part);
}

function newContext(count, warnings) {
  return { count, warnings, parts: [], counted: new Set() };
}

function claudeReport(root, count, warnings) {
  const context = newContext(count, warnings);
  const claudeFiles = ["CLAUDE.md", ".claude/CLAUDE.md", "CLAUDE.local.md"].filter((file) => exists(root, file));
  for (const file of claudeFiles.length ? claudeFiles : ["AGENTS.md"].filter((file) => exists(root, file))) {
    claudeInstructions(root, file, context);
  }
  const onDemand = [];
  for (const file of listFiles(root, ".claude/rules", (name) => name.endsWith(".md"), warnings, true)) {
    if (context.counted.has(file)) continue;
    context.counted.add(file);
    const text = readCounted(root, file, warnings);
    if (text === null) continue;
    const frontmatter = frontmatterOf(text);
    if (frontmatter && /^paths\s*:/m.test(frontmatter)) onDemand.push({ path: file, tokens: count(text) });
    else context.parts.push({ kind: "rules", path: file, tokens: count(stripHtmlComments(text)) });
  }
  for (const file of skillFiles(root, ".claude/skills", warnings)) describedPart(root, file, { kind: "skill", read: markdownDescription, cap: CLAUDE_DESCRIPTION_CAP }, context);
  for (const file of listFiles(root, ".claude/agents", (name) => name.endsWith(".md"), warnings)) describedPart(root, file, { kind: "agent", read: markdownDescription }, context);

  const settings = CLAUDE_SETTINGS.map((file) => readConfig(root, file, warnings) ?? {});
  const toolSearchOff = settings.some((config) => String(config.env?.ENABLE_TOOL_SEARCH).toLowerCase() === "false");
  const servers = readConfig(root, ".mcp.json", warnings)?.mcpServers ?? {};
  const mcpServers = Object.entries(servers).map(([name, server]) => ({ name, upfront: toolSearchOff || server?.alwaysLoad === true }));
  const hooks = [];
  for (const config of settings) {
    for (const event of ["SessionStart", "UserPromptSubmit"]) {
      for (const group of config.hooks?.[event] ?? []) {
        for (const hook of group?.hooks ?? []) if (hook?.command) hooks.push({ event, command: hook.command });
      }
    }
  }
  return { tool: "claude-code", parts: context.parts, onDemand, mcpServers, hooks };
}

function codexReport(root, count, warnings) {
  const context = newContext(count, warnings);
  const file = ["AGENTS.override.md", "AGENTS.md"].find((candidate) => exists(root, candidate));
  const text = file ? countInstructionFile(root, file, context) : null;
  const instructionBytes = text === null ? 0 : Buffer.byteLength(text, "utf8");
  for (const skill of skillFiles(root, ".agents/skills", warnings)) describedPart(root, skill, { kind: "skill", read: markdownDescription }, context);
  for (const agent of listFiles(root, ".codex/agents", (name) => name.endsWith(".toml"), warnings)) describedPart(root, agent, { kind: "agent", read: tomlDescription }, context);

  const config = readText(root, ".codex/config.toml") ?? "";
  let instructionCap = CODEX_DEFAULT_CAP;
  const capLine = /^project_doc_max_bytes\s*=\s*(.+)$/m.exec(config);
  if (capLine) {
    const value = capLine[1].replace(/#.*$/, "").trim();
    if (/^[1-9]\d*$/.test(value)) instructionCap = Number(value);
    else warnings.add(`project_doc_max_bytes in .codex/config.toml is not a positive integer; using ${formatNumber(CODEX_DEFAULT_CAP)}.`);
  }
  const droppedBytes = Math.max(0, instructionBytes - instructionCap);
  if (droppedBytes > 0) {
    warnings.add(`Codex drops ${formatNumber(droppedBytes)} bytes of instructions past project_doc_max_bytes (${formatNumber(instructionCap)}): shorten ${file} or move parts to folder-scoped files.`);
  }
  const mcpServers = [...config.matchAll(/^\[mcp_servers\.("?)([^\]."]+)\1\]/gm)].map((match) => ({ name: match[2], upfront: false }));
  return { tool: "codex", parts: context.parts, mcpServers, hooks: [], instructionBytes, instructionCap, droppedBytes };
}

function opencodeReport(root, count, warnings) {
  const context = newContext(count, warnings);
  const file = ["AGENTS.md", "CLAUDE.md"].find((candidate) => exists(root, candidate));
  if (file) countInstructionFile(root, file, context);
  const configFile = ["opencode.jsonc", "opencode.json", ".opencode/opencode.jsonc", ".opencode/opencode.json"].find((candidate) => exists(root, candidate));
  const config = (configFile && readConfig(root, configFile, warnings)) || {};
  const remoteInstructions = [];
  for (const entry of Array.isArray(config.instructions) ? config.instructions : []) {
    if (/^https?:\/\//.test(entry)) {
      remoteInstructions.push(entry);
    } else if (isOutside(path.posix.normalize(entry))) {
      warnings.add(`${entry}, in ${configFile} instructions, is outside the project; not counted.`);
    } else {
      for (const match of expandGlob(root, path.posix.normalize(entry), warnings)) countInstructionFile(root, match, context);
    }
  }
  for (const folder of [".opencode/skills", ".claude/skills", ".agents/skills"]) {
    for (const skill of skillFiles(root, folder, warnings)) describedPart(root, skill, { kind: "skill", read: markdownDescription }, context);
  }
  for (const agent of listFiles(root, ".opencode/agents", (name) => name.endsWith(".md"), warnings, true)) describedPart(root, agent, { kind: "agent", read: markdownDescription }, context);
  const mcp = config.mcp ?? {};
  const servers = mcp.servers && typeof mcp.servers === "object" ? mcp.servers : Object.fromEntries(Object.entries(mcp).filter(([, value]) => value && typeof value === "object"));
  const mcpServers = Object.keys(servers).map((name) => ({ name, upfront: false }));
  return { tool: "opencode", parts: context.parts, mcpServers, hooks: [], remoteInstructions };
}

const REPORTERS = { "claude-code": claudeReport, codex: codexReport, opencode: opencodeReport };

// At the root, dot folders hold the tools' own configuration (counted above) and
// `templates/` in the kit's own repository holds the files it installs; below the
// root every folder is searched except dependencies and git.
function isSkippedAtRoot(root, name) {
  return name.startsWith(".") || (name === "templates" && exists(root, "templates/actions/harness.md"));
}

function folderScopedFiles(root, count, warnings, relative = ".") {
  const found = [];
  for (const entry of directoryEntries(root, relative, warnings)) {
    const child = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) {
      const skipped = NEVER_SEARCHED.has(entry.name) || (relative === "." && isSkippedAtRoot(root, entry.name));
      if (!skipped) found.push(...folderScopedFiles(root, count, warnings, child));
    } else if (relative !== "." && INSTRUCTION_FILES.has(entry.name)) {
      const text = readCounted(root, child, warnings);
      if (text !== null) found.push({ path: child, tokens: count(text) });
    }
  }
  return found;
}

const largestFirst = (a, b) => b.tokens - a.tokens || a.path.localeCompare(b.path);

// The whole audit of a project, as a value. `budget` defaults to 10,000; the
// command line reads tools/context-audit.json and passes its budget in.
export async function auditProject(root, { budget = DEFAULT_BUDGET, counter } = {}) {
  const { count, method } = counter ?? (await makeCounter(root));
  const warnings = new Set();
  const tools = detectTools(root).map((id) => {
    const report = REPORTERS[id](root, count, warnings);
    report.parts.sort(largestFirst);
    report.total = report.parts.reduce((sum, part) => sum + part.tokens, 0);
    report.overBudget = Math.max(0, report.total - budget);
    if (report.overBudget > 0) warnings.add(`${TOOL_NAMES[id]} loads ${formatNumber(report.overBudget)} tokens over the budget of ${formatNumber(budget)}.`);
    return report;
  });
  const overBudget = tools.some((report) => report.overBudget > 0);
  const codexDrops = tools.some((report) => report.droppedBytes > 0);
  return {
    counter: { method, note: method === "o200k_base" ? "o200k_base; approximate for Claude models" : `≈ estimate: characters ÷ 4 (for real counts: ${INSTALL_TOKENIZER})` },
    budget,
    tools,
    folderScoped: folderScopedFiles(root, count, warnings).sort(largestFirst),
    warnings: [...warnings],
    failures: [...(overBudget ? ["over budget"] : []), ...(codexDrops ? ["Codex would drop instructions"] : [])],
    exitCode: overBudget || codexDrops ? 1 : 0,
  };
}

// ── Command line ────────────────────────────────────────────────────────────

function parseArguments(argv) {
  const options = { json: false, budget: null };
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === "--json") options.json = true;
    else if (argument === "--budget") {
      const value = argv[++index];
      if (!/^[1-9]\d*$/.test(value ?? "")) throw new UsageError(`--budget takes a positive whole number of tokens, not "${value ?? ""}".`);
      options.budget = Number(value);
    } else throw new UsageError(`Unknown option: ${argument}. Usage: node tools/context-audit.mjs [--json] [--budget <tokens>]`);
  }
  return options;
}

function configuredBudget(root) {
  const relative = "tools/context-audit.json";
  const text = readText(root, relative);
  if (text === null) return DEFAULT_BUDGET;
  let config;
  try {
    config = JSON.parse(text);
  } catch (error) {
    throw new UsageError(`${relative} is not valid JSON: ${error.message}`);
  }
  if (!config || typeof config !== "object" || Array.isArray(config)) throw new UsageError(`${relative} must hold a JSON object, such as { "budget": 10000 }.`);
  if (config.budget === undefined) return DEFAULT_BUDGET;
  if (!Number.isInteger(config.budget) || config.budget <= 0) throw new UsageError(`"budget" in ${relative} must be a positive whole number of tokens.`);
  return config.budget;
}

export function renderText(audit) {
  const mark = audit.counter.method === "estimate" ? "≈" : "";
  const amount = (tokens) => `${mark}${formatNumber(tokens)}`.padStart(9);
  const lines = ["Context audit: what each agent tool loads from this project before the first prompt", `Counting: ${audit.counter.note}`, ""];
  if (audit.tools.length === 0) lines.push("No agent tool found (no .claude/, .codex/, .opencode/, CLAUDE.md, or AGENTS.md).", "");
  for (const report of audit.tools) {
    const over = report.overBudget > 0 ? `, ${formatNumber(report.overBudget)} over budget` : "";
    lines.push(`${TOOL_NAMES[report.tool]}: ${mark}${formatNumber(report.total)} of ${formatNumber(audit.budget)} tokens${over}`);
    for (const part of report.parts) lines.push(`${amount(part.tokens)}  ${part.path}  (${part.kind}${part.note ? `, ${part.note}` : ""})`);
    if (report.parts.length === 0) lines.push("          nothing loaded from the project");
    if (report.onDemand?.length) {
      lines.push("  Loaded on demand (rules with paths), not counted:");
      for (const part of report.onDemand) lines.push(`${amount(part.tokens)}  ${part.path}`);
    }
    if (report.tool === "codex") lines.push(`  Instructions: ${formatNumber(report.instructionBytes)} of ${formatNumber(report.instructionCap)} bytes Codex reads`);
    if (report.mcpServers.length) {
      const names = report.mcpServers.map((server) => (server.upfront ? `${server.name} (loads tool definitions upfront)` : server.name));
      lines.push(`  MCP servers, not counted: ${names.join(", ")}`);
    }
    for (const hook of report.hooks) lines.push(`  Hook that adds context, not counted: ${hook.event}: ${hook.command}`);
    if (report.remoteInstructions?.length) lines.push(`  Remote instructions, not fetched: ${report.remoteInstructions.join(", ")}`);
    lines.push("");
  }
  if (audit.folderScoped.length) {
    lines.push("Folder-scoped files (load when the agent works in that folder; in no total):");
    for (const file of audit.folderScoped) lines.push(`${amount(file.tokens)}  ${file.path}`);
    lines.push("");
  }
  if (audit.warnings.length) {
    lines.push("Warnings:");
    for (const warning of audit.warnings) lines.push(`  - ${warning}`);
    lines.push("");
  }
  lines.push(audit.exitCode === 0 ? "Result: within budget." : `Result: ${audit.failures.join("; ")} (exit 1).`);
  return lines.join("\n");
}

export async function main(argv = process.argv.slice(2), root = process.cwd()) {
  try {
    const options = parseArguments(argv);
    const budget = options.budget ?? configuredBudget(root);
    const audit = await auditProject(root, { budget });
    console.log(options.json ? JSON.stringify(audit, null, 2) : renderText(audit));
    return audit.exitCode;
  } catch (error) {
    // Exit 1 means "over budget"; anything that kept the audit from finishing is 2.
    console.error(error instanceof UsageError ? error.message : `context-audit: ${error.message}`);
    return 2;
  }
}

function isEntryPoint() {
  try {
    return process.argv[1] !== undefined && realpathSync(process.argv[1]) === realpathSync(scriptFile);
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  process.exitCode = await main();
}
