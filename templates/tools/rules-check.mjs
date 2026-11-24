#!/usr/bin/env node
//
// Rules check: keeps the AGENTS.md files short, consistent, and true.
//
// It reads every AGENTS.md in the project and the "Project Rules" tables in
// them (a table whose header has "ID" and "Rule"), and fails when:
// - two rows share an ID, or a retired ID (tools/rules-check.json "retired")
//   comes back: an ID always means the same rule;
// - a rule is longer than "maxRuleLength" characters: a rule is one line;
// - "Enforced by" holds a value outside "enforcedBy";
// - a row has no "Why" when the table has that column;
// - a file points to a context file by line number ("AGENTS.md:47", "#L47"):
//   lines move, and the pointer silently lies;
// - a path in backticks that looks like a project path does not exist (paths
//   under "createdLater", which workflows create when first used, are fine);
// - a file is over its line budget ("budgets", HTML comments not counted);
// - a CLAUDE.md does not import AGENTS.md ("@AGENTS.md").
//
// Usage: node tools/rules-check.mjs     Exit 1 when something fails, 2 when it
// cannot run (rules-check.json missing or broken).
// No dependencies beyond Node.js 20.

import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptFile = fileURLToPath(import.meta.url);
const projectDirectory = path.resolve(path.dirname(scriptFile), "..");
const skipped = new Set(["node_modules", ".git", "dist", "build", "vendor", "coverage", ".next"]);

export function findContextFiles(root, names = ["AGENTS.md", "CLAUDE.md"]) {
  const found = [];
  const walk = (folder) => {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!skipped.has(entry.name) && !entry.name.startsWith(".")) walk(path.join(folder, entry.name));
      } else if (names.includes(entry.name)) {
        found.push(path.relative(root, path.join(folder, entry.name)).split(path.sep).join("/"));
      }
    }
  };
  walk(root);
  return found.sort();
}

const cells = (line) => line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());

// The rows of the rule tables in one file: { id, rule, enforcedBy, why, line }.
export function ruleRows(text) {
  const rows = [];
  let columns = null;
  let inFence = false;
  text.split("\n").forEach((line, index) => {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    if (inFence) return;
    if (!/^\s*\|/.test(line)) {
      columns = null;
      return;
    }
    const row = cells(line);
    if (!columns) {
      if (row.includes("ID") && row.includes("Rule")) columns = row;
      return;
    }
    if (/^[\s:|-]+$/.test(line)) return;
    const value = (name) => (columns.includes(name) ? row[columns.indexOf(name)] ?? "" : undefined);
    rows.push({ id: value("ID"), rule: value("Rule"), enforcedBy: value("Enforced by"), why: value("Why"), line: index + 1 });
  });
  return rows.filter((row) => row.id);
}

export function lineReferences(text) {
  const found = [];
  text.split("\n").forEach((line, index) => {
    if (/\b(AGENTS|CLAUDE)\.md(:\d+|#L\d+)|\bline \d+ of (AGENTS|CLAUDE)\.md/i.test(line)) found.push(index + 1);
  });
  return found;
}

// Paths in backticks that look like project paths (a folder and a file or a
// folder ending in /), without globs, placeholders, or URLs.
export function citedPaths(text) {
  return [...text.matchAll(/`([^`\s]+)`/g)]
    .map((match) => match[1].replace(/[:#].*$/, ""))
    .filter((value) => /^[\w.-]+(\/[\w.@-]+)+\/?$/.test(value) && !/[*<>{}$]/.test(value) && !/^(https?|www)\b/.test(value));
}

const countedLines = (text) => text.replace(/<!--[\s\S]*?-->/g, "").split("\n").length;

export function checkProject(root, config) {
  const problems = [];
  const files = findContextFiles(root);
  const seen = new Map();
  const retired = new Set(config.retired ?? []);
  const enforcedBy = (config.enforcedBy ?? []).map((value) => value.toLowerCase());

  for (const file of files) {
    const text = readFileSync(path.join(root, file), "utf8");
    const folder = path.posix.dirname(file);

    if (path.posix.basename(file) === "CLAUDE.md") {
      if (config.claudeImportsAgents !== false && existsSync(path.join(root, folder, "AGENTS.md")) && !/^@AGENTS\.md\s*$/m.test(text)) {
        problems.push(`${file}: does not import AGENTS.md; add the line @AGENTS.md so both tools read the same rules`);
      }
      continue;
    }

    const budget = folder === "." ? config.budgets?.root : config.budgets?.nested;
    if (budget && countedLines(text) > budget) problems.push(`${file}: ${countedLines(text)} lines, over the budget of ${budget}; move procedures to workflows and checkable rules to checks`);

    for (const line of lineReferences(text)) problems.push(`${file}:${line}: points to a context file by line number; point to a rule ID or a heading instead`);

    for (const cited of new Set(citedPaths(text))) {
      if ((config.createdLater ?? []).some((prefix) => cited === prefix || cited.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`))) continue;
      const fromFolder = path.join(root, folder, cited);
      const fromRoot = path.join(root, cited);
      if (!existsSync(fromFolder) && !existsSync(fromRoot)) problems.push(`${file}: cites \`${cited}\`, which does not exist`);
    }

    for (const row of ruleRows(text)) {
      const where = `${file}:${row.line} ${row.id}`;
      if (seen.has(row.id)) problems.push(`${where}: the ID is also used in ${seen.get(row.id)}`);
      else seen.set(row.id, `${file}:${row.line}`);
      if (retired.has(row.id)) problems.push(`${where}: the ID was retired; give the rule a new ID`);
      if ((row.rule ?? "").length > (config.maxRuleLength ?? 280)) problems.push(`${where}: the rule has ${row.rule.length} characters (at most ${config.maxRuleLength ?? 280}); put the explanation behind "Why"`);
      if (row.enforcedBy !== undefined && enforcedBy.length > 0) {
        const values = row.enforcedBy.toLowerCase().split(/[,+/]/).map((value) => value.trim()).filter(Boolean);
        const unknown = values.filter((value) => !enforcedBy.includes(value));
        if (values.length === 0 || unknown.length > 0) problems.push(`${where}: "Enforced by" must be one of ${enforcedBy.join(", ")}`);
      }
      if (row.why !== undefined && row.why.trim() === "") problems.push(`${where}: no "Why"`);
    }
  }
  return { files, problems };
}

function main() {
  const config = JSON.parse(readFileSync(path.join(path.dirname(scriptFile), "rules-check.json"), "utf8"));
  const { files, problems } = checkProject(projectDirectory, config);
  if (problems.length === 0) {
    console.log(`rules-check: ${files.length} context file(s) hold together.`);
    return 0;
  }
  console.error(`rules-check: ${problems.length} problem(s):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  return 1;
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
    console.error(`rules-check: ${error.message}`);
    process.exitCode = 2; // Exit 1 means the check failed; 2 means it could not run.
  }
}
