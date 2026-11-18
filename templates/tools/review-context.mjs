#!/usr/bin/env node
//
// Review context: lists the project rules a diff reaches, so a reviewer reads
// those rules and cites them by ID instead of reading every convention file.
//
// Rules live once, as rows of a table in an AGENTS.md (see "Project Rules" in
// the root AGENTS.md). A rule in folder/AGENTS.md applies to files under that
// folder, narrowed by its "Applies to" globs when the row has them.
//
// Usage:
//   node tools/review-context.mjs <fixed-point>   # files in git diff <fixed-point>...HEAD
//   node tools/review-context.mjs --worktree      # uncommitted and untracked files
//   node tools/review-context.mjs --files a b c   # these files
//   add --json for machine-readable output
//
// No dependencies beyond Node.js 20.

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptFile = fileURLToPath(import.meta.url);
// Installed at <project>/tools/review-context.mjs.
export const projectDirectory = path.resolve(path.dirname(scriptFile), "..");

const skippedFolders = new Set(["node_modules", ".git", "dist", "build", "vendor", "coverage", ".next"]);
// "Enforced by" values that mean a machine already refuses the breach.
const machineEnforced = /\b(lint|eslint|linter|type ?check|tsc|test|guardrail|hook|ci|formatter)\b/i;

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

function git(args) {
  return execFileSync("git", args, { cwd: projectDirectory, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
    .split("\n")
    .filter(Boolean);
}

function findAgentsFiles(directory = projectDirectory, relative = "") {
  const found = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (skippedFolders.has(entry.name) || entry.name.startsWith(".")) continue;
      found.push(...findAgentsFiles(path.join(directory, entry.name), path.posix.join(relative, entry.name)));
    } else if (entry.name === "AGENTS.md") {
      found.push(path.posix.join(relative, entry.name));
    }
  }
  return found;
}

function cells(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim());
}

function globsIn(text) {
  const quoted = [...text.matchAll(/`([^`]+)`/g)].map((match) => match[1]);
  const globs = quoted.length > 0 ? quoted : text.split(/[,\s]+/);
  return globs.map((glob) => glob.trim()).filter((glob) => glob !== "" && !/^(all|any|-|—)$/i.test(glob));
}

// Reads the rule rows of every table whose header has "ID" and "Rule" columns.
export function parseRules(document, agentsFile) {
  const scope = path.posix.dirname(agentsFile) === "." ? "" : path.posix.dirname(agentsFile);
  const lines = document.split("\n");
  const rules = [];

  for (let i = 0; i + 1 < lines.length; i += 1) {
    if (!lines[i].trim().startsWith("|") || !/^\s*\|?\s*:?-{3,}/.test(lines[i + 1])) continue;
    const header = cells(lines[i]).map((cell) => cell.toLowerCase());
    const id = header.indexOf("id");
    const rule = header.findIndex((cell) => cell === "rule" || cell === "regra");
    if (id === -1 || rule === -1) continue;

    const column = (...names) => header.findIndex((cell) => names.includes(cell));
    const applies = column("applies to", "applies", "paths", "scope");
    const enforced = column("enforced by", "enforced", "cobra");
    const why = column("why", "por quê", "porque");

    for (let row = i + 2; row < lines.length && lines[row].trim().startsWith("|"); row += 1) {
      const values = cells(lines[row]);
      const ruleId = (values[id] ?? "").replace(/[`*]/g, "");
      if (!/^[A-Z][A-Z0-9]*-\d+[a-z]?$/.test(ruleId)) continue;
      rules.push({
        id: ruleId,
        rule: values[rule] ?? "",
        appliesTo: applies === -1 ? [] : globsIn(values[applies] ?? ""),
        enforcedBy: enforced === -1 ? "" : values[enforced] ?? "",
        why: why === -1 ? "" : values[why] ?? "",
        source: agentsFile,
        scope,
      });
    }
    i += 1;
  }
  return rules;
}

// Whether a rule reaches a project-relative file.
export function ruleApplies(rule, file) {
  const inScope = rule.scope === "" || file === rule.scope || file.startsWith(`${rule.scope}/`);
  if (!inScope) return false;
  if (rule.appliesTo.length === 0) return true;
  const local = rule.scope === "" ? file : file.slice(rule.scope.length + 1);
  return rule.appliesTo.some((glob) => globToRegExp(glob).test(local) || globToRegExp(glob).test(file));
}

// Returns the rules the files reach, each with the files it reaches.
export function rulesForFiles(rules, files) {
  return rules
    .map((rule) => ({ ...rule, files: files.filter((file) => ruleApplies(rule, file)) }))
    .filter((rule) => rule.files.length > 0)
    .map((rule) => ({ ...rule, machineEnforced: machineEnforced.test(rule.enforcedBy) }));
}

function changedFiles(args) {
  if (args[0] === "--files") return args.slice(1);
  if (args[0] === "--worktree") {
    return [...new Set([...git(["diff", "--name-only", "HEAD"]), ...git(["ls-files", "--others", "--exclude-standard"])])];
  }
  if (!args[0]) throw new Error("Name a fixed point (a commit, branch, or tag), --worktree, or --files <paths>.");
  return git(["diff", "--name-only", `${args[0]}...HEAD`]);
}

function report(matched, files) {
  if (matched.length === 0) {
    return `No project rule reaches these ${files.length} file(s). Review against the knowledge base only.`;
  }
  const toReview = matched.filter((rule) => !rule.machineEnforced);
  const byMachine = matched.filter((rule) => rule.machineEnforced);
  const line = (rule) =>
    `- **${rule.id}** (${rule.source}) ${rule.rule}${rule.why ? ` — why: ${rule.why}` : ""}\n  reaches: ${rule.files.join(", ")}`;

  return [
    `# Rules this diff reaches (${files.length} file(s))`,
    "",
    "Check the diff against these, and cite the ID in every finding about one.",
    "",
    "## Enforced by review",
    toReview.length > 0 ? toReview.map(line).join("\n") : "None.",
    "",
    "## Enforced by a machine (do not re-review; check the tool ran)",
    byMachine.length > 0 ? byMachine.map((rule) => `- **${rule.id}** ${rule.rule} — ${rule.enforcedBy}`).join("\n") : "None.",
  ].join("\n");
}

function main() {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const files = changedFiles(args.filter((arg) => arg !== "--json"));
  const rules = findAgentsFiles().flatMap((file) =>
    parseRules(readFileSync(path.join(projectDirectory, file), "utf8"), file),
  );
  const matched = rulesForFiles(rules, files);
  console.log(json ? JSON.stringify({ files, rules: matched }, null, 2) : report(matched, files));
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
  } catch (error) {
    console.error(`review-context: ${error.message}`);
    process.exitCode = 1;
  }
}
