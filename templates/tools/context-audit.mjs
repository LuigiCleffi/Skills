#!/usr/bin/env node
//
// Context audit: what each agent tool (Claude Code, Codex, OpenCode) loads
// from this project before the first prompt, largest first, against a budget.
// It reads files only: it never starts an MCP server or runs a hook.
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
//
// Tokens: js-tiktoken's o200k_base when the project has it installed (approximate for
// Claude models), else characters divided by four, labeled as an estimate.
//
// Exit codes: 0 within budget, 1 over budget or Codex would drop text, 2 usage error.

import { createRequire } from "node:module";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const DEFAULT_BUDGET = 10000;
const CODEX_DEFAULT_CAP = 32768;
const CLAUDE_DESCRIPTION_CAP = 1536;
const MAX_IMPORT_HOPS = 4;
const NEVER_SEARCHED = new Set(["node_modules", ".git"]);
const SKIPPED_FOLDERS = new Set([...NEVER_SEARCHED, "templates"]);
const INSTRUCTION_FILES = new Set(["AGENTS.md", "AGENTS.override.md", "CLAUDE.md", "CLAUDE.local.md"]);
const TOOL_NAMES = { "claude-code": "Claude Code", codex: "Codex", opencode: "OpenCode" };
const INSTALL_TOKENIZER = "npm install --save-dev js-tiktoken";

class UsageError extends Error {}

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

function listFiles(root, relative, predicate, recursive = false) {
  if (!isDirectory(root, relative)) return [];
  const found = [];
  for (const entry of readdirSync(path.join(root, relative), { withFileTypes: true })) {
    const child = path.posix.join(relative, entry.name);
    if (entry.isDirectory() && recursive && !NEVER_SEARCHED.has(entry.name)) found.push(...listFiles(root, child, predicate, true));
    else if (entry.isFile() && predicate(entry.name)) found.push(child);
  }
  return found.sort();
}

// Skill folders hold one SKILL.md each: `<folder>/<name>/SKILL.md`.
function skillFiles(root, folder) {
  if (!isDirectory(root, folder)) return [];
  return readdirSync(path.join(root, folder), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && exists(root, path.posix.join(folder, entry.name, "SKILL.md")))
    .map((entry) => path.posix.join(folder, entry.name, "SKILL.md"))
    .sort();
}

function parseJsonc(text) {
  let result = "";
  let inString = false;
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (inString) {
      result += character;
      if (character === "\\") result += text[++index] ?? "";
      else if (character === '"') inString = false;
    } else if (character === '"') {
      inString = true;
      result += character;
    } else if (character === "/" && text[index + 1] === "/") {
      while (index < text.length && text[index] !== "\n") index++;
      result += "\n";
    } else if (character === "/" && text[index + 1] === "*") {
      index = text.indexOf("*/", index + 2);
      if (index < 0) break;
      index++;
    } else {
      result += character;
    }
  }
  return JSON.parse(result.replace(/,(\s*[}\]])/g, "$1"));
}

// Reads a JSON (or JSONC) config; a malformed one is a warning, not a failure.
function readConfig(root, relative, warnings, { jsonc = false } = {}) {
  const text = readText(root, relative);
  if (text === null) return null;
  try {
    return jsonc ? parseJsonc(text) : JSON.parse(text);
  } catch {
    warnings.add(`${relative} is not valid JSON; what it configures is not listed.`);
    return null;
  }
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

function expandGlob(root, pattern) {
  if (!/[*?]/.test(pattern)) return exists(root, pattern) ? [path.posix.normalize(pattern)] : [];
  const base = pattern.slice(0, pattern.search(/[*?]/)).replace(/[^/]*$/, "").replace(/\/$/, "") || ".";
  const matcher = globToRegExp(pattern);
  return listFiles(root, base, () => true, true)
    .map((file) => path.posix.normalize(file))
    .filter((file) => matcher.test(file));
}

// ── Counting tokens ─────────────────────────────────────────────────────────

// js-tiktoken from the project when installed (ADR-0001), else a labeled estimate.
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
    const text = readText(root, current);
    if (text === null) {
      context.warnings.add(`${current} cannot be read; not counted.`);
      continue;
    }
    context.counted.add(current);
    const kind = chain.length === 1 ? "instructions" : "import";
    context.parts.push({ kind, path: current, tokens: context.count(stripHtmlComments(text)) });
    for (const target of importsOf(text)) {
      const resolved = target.startsWith("~/") || path.isAbsolute(target) ? null : path.posix.normalize(path.posix.join(path.posix.dirname(current), target));
      if (!resolved || resolved.startsWith("../")) {
        context.warnings.add(`${target}, imported by ${current}, is outside the project; not counted.`);
      } else if (!exists(root, resolved)) {
        context.warnings.add(`${resolved}, imported by ${current}, does not exist.`);
      } else if (chain.length > MAX_IMPORT_HOPS) {
        context.warnings.add(`${resolved} is not counted: Claude Code follows imports up to four hops (${[...chain, resolved].join(" → ")}).`);
      } else if (!context.counted.has(resolved)) {
        queue.push({ file: resolved, chain: [...chain, resolved] });
      }
    }
  }
}

function describedPart(root, file, { kind, toml = false, cap = Infinity }, context) {
  const text = readText(root, file);
  if (text === null) {
    context.warnings.add(`${file} cannot be read; not counted.`);
    return;
  }
  let name;
  let description;
  if (toml) {
    name = tomlString(text, "name");
    description = tomlString(text, "description");
  } else {
    const frontmatter = frontmatterOf(text);
    name = frontmatter && frontmatterValue(frontmatter, "name");
    description = frontmatter && [frontmatterValue(frontmatter, "description"), frontmatterValue(frontmatter, "when_to_use")].filter(Boolean).join("\n");
  }
  if (!description) {
    context.warnings.add(`${file} has no description, so tools do not list it.`);
    context.parts.push({ kind, path: file, tokens: 0, note: "no description" });
    return;
  }
  const part = { kind, path: file };
  if (description.length > cap) {
    description = description.slice(0, cap);
    part.note = `description capped at ${cap.toLocaleString("en-US")} characters`;
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
  for (const file of listFiles(root, ".claude/rules", (name) => name.endsWith(".md"), true)) {
    const text = readText(root, file) ?? "";
    const frontmatter = frontmatterOf(text);
    if (frontmatter && /^paths\s*:/m.test(frontmatter)) onDemand.push({ path: file, tokens: count(text) });
    else if (!context.counted.has(file)) {
      context.counted.add(file);
      context.parts.push({ kind: "rules", path: file, tokens: count(stripHtmlComments(text)) });
    }
  }
  for (const file of skillFiles(root, ".claude/skills")) describedPart(root, file, { kind: "skill", cap: CLAUDE_DESCRIPTION_CAP }, context);
  for (const file of listFiles(root, ".claude/agents", (name) => name.endsWith(".md"))) describedPart(root, file, { kind: "agent" }, context);

  const settings = readConfig(root, ".claude/settings.json", warnings) ?? {};
  const toolSearchOff = String(settings.env?.ENABLE_TOOL_SEARCH).toLowerCase() === "false";
  const servers = readConfig(root, ".mcp.json", warnings)?.mcpServers ?? {};
  const mcpServers = Object.entries(servers).map(([name, server]) => ({ name, upfront: toolSearchOff || server?.alwaysLoad === true }));
  const hooks = [];
  for (const event of ["SessionStart", "UserPromptSubmit"]) {
    for (const group of settings.hooks?.[event] ?? []) {
      for (const hook of group?.hooks ?? []) if (hook?.command) hooks.push({ event, command: hook.command });
    }
  }
  return { tool: "claude-code", parts: context.parts, onDemand, mcpServers, hooks };
}

function codexReport(root, count, warnings) {
  const context = newContext(count, warnings);
  const file = ["AGENTS.override.md", "AGENTS.md"].find((candidate) => exists(root, candidate));
  let instructionBytes = 0;
  if (file) {
    const text = readText(root, file) ?? "";
    instructionBytes = Buffer.byteLength(text, "utf8");
    context.parts.push({ kind: "instructions", path: file, tokens: count(text) });
  }
  for (const skill of skillFiles(root, ".agents/skills")) describedPart(root, skill, { kind: "skill" }, context);
  for (const agent of listFiles(root, ".codex/agents", (name) => name.endsWith(".toml"))) describedPart(root, agent, { kind: "agent", toml: true }, context);

  const config = readText(root, ".codex/config.toml") ?? "";
  let instructionCap = CODEX_DEFAULT_CAP;
  const capLine = /^project_doc_max_bytes\s*=\s*(.+)$/m.exec(config);
  if (capLine) {
    const value = capLine[1].replace(/#.*$/, "").trim();
    if (/^[1-9]\d*$/.test(value)) instructionCap = Number(value);
    else warnings.add(`project_doc_max_bytes in .codex/config.toml is not a positive integer; using ${CODEX_DEFAULT_CAP.toLocaleString("en-US")}.`);
  }
  const droppedBytes = Math.max(0, instructionBytes - instructionCap);
  if (droppedBytes > 0) {
    warnings.add(`Codex drops ${droppedBytes.toLocaleString("en-US")} bytes of instructions past project_doc_max_bytes (${instructionCap.toLocaleString("en-US")}): shorten ${file} or move parts to folder-scoped files.`);
  }
  const mcpServers = [...config.matchAll(/^\[mcp_servers\.("?)([^\]."]+)\1\]/gm)].map((match) => ({ name: match[2], upfront: false }));
  return { tool: "codex", parts: context.parts, mcpServers, hooks: [], instructionBytes, instructionCap, droppedBytes };
}

function opencodeReport(root, count, warnings) {
  const context = newContext(count, warnings);
  const file = ["AGENTS.md", "CLAUDE.md"].find((candidate) => exists(root, candidate));
  if (file) {
    context.counted.add(file);
    context.parts.push({ kind: "instructions", path: file, tokens: count(readText(root, file) ?? "") });
  }
  const configFile = ["opencode.jsonc", "opencode.json", ".opencode/opencode.jsonc", ".opencode/opencode.json"].find((candidate) => exists(root, candidate));
  const config = configFile ? readConfig(root, configFile, warnings, { jsonc: true }) ?? {} : {};
  const remoteInstructions = [];
  for (const entry of Array.isArray(config.instructions) ? config.instructions : []) {
    if (/^https?:\/\//.test(entry)) {
      remoteInstructions.push(entry);
      continue;
    }
    for (const match of expandGlob(root, entry)) {
      if (context.counted.has(match)) continue;
      context.counted.add(match);
      context.parts.push({ kind: "instructions", path: match, tokens: count(readText(root, match) ?? "") });
    }
  }
  for (const folder of [".opencode/skills", ".claude/skills", ".agents/skills"]) {
    for (const skill of skillFiles(root, folder)) describedPart(root, skill, { kind: "skill" }, context);
  }
  for (const agent of listFiles(root, ".opencode/agents", (name) => name.endsWith(".md"), true)) describedPart(root, agent, { kind: "agent" }, context);
  const mcp = config.mcp ?? {};
  const servers = mcp.servers && typeof mcp.servers === "object" ? mcp.servers : Object.fromEntries(Object.entries(mcp).filter(([, value]) => value && typeof value === "object"));
  const mcpServers = Object.keys(servers).map((name) => ({ name, upfront: false }));
  return { tool: "opencode", parts: context.parts, mcpServers, hooks: [], remoteInstructions };
}

const REPORTERS = { "claude-code": claudeReport, codex: codexReport, opencode: opencodeReport };

function folderScopedFiles(root, count, relative = ".") {
  const found = [];
  for (const entry of readdirSync(path.join(root, relative), { withFileTypes: true })) {
    const child = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) {
      if (!SKIPPED_FOLDERS.has(entry.name) && !entry.name.startsWith(".")) found.push(...folderScopedFiles(root, count, child));
    } else if (relative !== "." && INSTRUCTION_FILES.has(entry.name)) {
      found.push({ path: child, tokens: count(readText(root, child) ?? "") });
    }
  }
  return found;
}

const largestFirst = (a, b) => b.tokens - a.tokens || a.path.localeCompare(b.path);

// The whole audit of a project, as a value. `budget` defaults to the config's.
export async function auditProject(root, { budget = DEFAULT_BUDGET, counter } = {}) {
  const { count, method } = counter ?? (await makeCounter(root));
  const warnings = new Set();
  const tools = detectTools(root).map((id) => {
    const report = REPORTERS[id](root, count, warnings);
    report.parts.sort(largestFirst);
    report.total = report.parts.reduce((sum, part) => sum + part.tokens, 0);
    report.overBudget = Math.max(0, report.total - budget);
    if (report.overBudget > 0) warnings.add(`${TOOL_NAMES[id]} loads ${report.overBudget.toLocaleString("en-US")} tokens over the budget of ${budget.toLocaleString("en-US")}.`);
    return report;
  });
  const failed = tools.some((report) => report.overBudget > 0 || report.droppedBytes > 0);
  return {
    counter: { method, note: method === "o200k_base" ? "o200k_base; approximate for Claude models" : `estimate: characters ÷ 4 (for real counts: ${INSTALL_TOKENIZER})` },
    budget,
    tools,
    folderScoped: folderScopedFiles(root, count).sort(largestFirst),
    warnings: [...warnings],
    exitCode: failed ? 1 : 0,
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
  if (config.budget === undefined) return DEFAULT_BUDGET;
  if (!Number.isInteger(config.budget) || config.budget <= 0) throw new UsageError(`"budget" in ${relative} must be a positive whole number of tokens.`);
  return config.budget;
}

const pad = (tokens) => tokens.toLocaleString("en-US").padStart(8);

export function renderText(audit) {
  const lines = ["Context audit: what each agent tool loads from this project before the first prompt", `Counting: ${audit.counter.note}`, ""];
  if (audit.tools.length === 0) lines.push("No agent tool found (no .claude/, .codex/, .opencode/, CLAUDE.md, or AGENTS.md).", "");
  for (const report of audit.tools) {
    const over = report.overBudget > 0 ? `, ${report.overBudget.toLocaleString("en-US")} over budget` : "";
    lines.push(`${TOOL_NAMES[report.tool]}: ${report.total.toLocaleString("en-US")} of ${audit.budget.toLocaleString("en-US")} tokens${over}`);
    for (const part of report.parts) lines.push(`${pad(part.tokens)}  ${part.path}  (${part.kind}${part.note ? `, ${part.note}` : ""})`);
    if (report.parts.length === 0) lines.push("         nothing loaded from the project");
    if (report.onDemand?.length) {
      lines.push("  Loaded on demand (rules with paths), not counted:");
      for (const part of report.onDemand) lines.push(`${pad(part.tokens)}  ${part.path}`);
    }
    if (report.tool === "codex") lines.push(`  Instructions: ${report.instructionBytes.toLocaleString("en-US")} of ${report.instructionCap.toLocaleString("en-US")} bytes Codex reads`);
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
    for (const file of audit.folderScoped) lines.push(`${pad(file.tokens)}  ${file.path}`);
    lines.push("");
  }
  if (audit.warnings.length) {
    lines.push("Warnings:");
    for (const warning of audit.warnings) lines.push(`  - ${warning}`);
    lines.push("");
  }
  lines.push(audit.exitCode === 0 ? "Result: within budget." : "Result: over budget (exit 1).");
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
    if (!(error instanceof UsageError)) throw error;
    console.error(error.message);
    return 2;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
