#!/usr/bin/env node
//
// Diff rulers: project conventions checked on the lines the current change
// ADDED, never on the whole repository, so old code never turns into a
// mandatory cleanup and a new convention can start today.
//
// Each ruler in tools/rulers.json says which files it reads and what it
// refuses: a regular expression per added line ("pattern"), or a block of
// consecutive added comment lines longer than "maxLines" ("comment-block").
// A line can opt out with the ruler's marker and a reason, on the line or the
// line above: `// ruler:allow-any — the SDK types this as any`. The reason is
// required and stays searchable. "legacy" lists files tolerated as they are;
// the list only shrinks: a legacy file that now complies fails until it is
// removed from the list.
//
// Usage:
//   node tools/rulers.mjs [--base origin/main]
// The base is --base, else $CHECKS_BASE (set by checks/checks.mjs), else the
// config's "base". Untracked files count as all added. A diff wider than
// "maxFiles" files, or a branch in "skipBranches" (an accumulator of work
// already reviewed), gets no verdict instead of a wrong one.
// Exit 1 when a ruler is broken. No dependencies beyond Node.js 20 and git.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptFile = fileURLToPath(import.meta.url);

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

export const matchesAny = (file, globs = []) => globs.some((glob) => globToRegExp(glob).test(file));

// New-file line numbers of the "+" lines, per file, from a unified diff.
export function addedLines(diff) {
  const byFile = new Map();
  let file = null;
  let cursor = 0;
  for (const line of diff.split("\n")) {
    const header = /^\+\+\+ b\/(.+)$/.exec(line);
    if (header) {
      file = header[1];
      if (!byFile.has(file)) byFile.set(file, new Set());
      continue;
    }
    if (/^\+\+\+ \/dev\/null/.test(line)) {
      file = null;
      continue;
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)/.exec(line);
    if (hunk) {
      cursor = Number(hunk[1]);
      continue;
    }
    if (!file || line.startsWith("---")) continue;
    if (line.startsWith("+")) byFile.get(file).add(cursor++);
    else if (line.startsWith("-") || line.startsWith("\\")) continue;
    else cursor += 1;
  }
  return byFile;
}

// git diff never lists an untracked file, so a brand-new file would read as
// nothing added: every line of an untracked file is added.
export function withUntracked(byFile, untracked) {
  for (const { file, lineCount } of untracked) {
    byFile.set(file, new Set(Array.from({ length: lineCount }, (_, index) => index + 1)));
  }
  return byFile;
}

const commentLine = /^\s*(\/\/|#(?!!)|\*|\/\*|--|<!--)/;

// An opt-out marker with its reason, on the line or the line above. A marker
// without a reason is itself a violation.
function optOut(lines, number, marker) {
  for (const candidate of [lines[number - 1], lines[number - 2]]) {
    if (candidate === undefined || !candidate.includes(marker)) continue;
    const reason = candidate.slice(candidate.indexOf(marker) + marker.length).replace(/^[\s:—–-]+/, "").replace(/\*\/|-->/g, "").trim();
    return reason.split(/\s+/).filter(Boolean).length >= 2 ? "allowed" : "no-reason";
  }
  return null;
}

// The violations of one ruler in one file's lines; `judged` limits them to
// the given line numbers (the added ones), or all lines when null.
export function violations(ruler, lines, judged = null) {
  const found = [];
  const inScope = (number) => judged === null || judged.has(number);
  const report = (number, message) => {
    const marker = ruler.allow ? optOut(lines, number, ruler.allow) : null;
    if (marker === "allowed") return;
    found.push({ line: number, message: marker === "no-reason" ? `${ruler.allow} needs a reason after it` : message });
  };

  if (ruler.kind === "comment-block") {
    let start = null;
    const max = ruler.maxLines ?? 6;
    for (let number = 1; number <= lines.length + 1; number += 1) {
      const isComment = number <= lines.length && inScope(number) && commentLine.test(lines[number - 1]);
      if (isComment && start === null) start = number;
      if (!isComment && start !== null) {
        const length = number - start;
        if (length > max) report(start, `${length} lines of comment (at most ${max}): ${ruler.message ?? "say it in fewer lines, or in the commit or the docs"}`);
        start = null;
      }
    }
    return found;
  }

  const pattern = new RegExp(ruler.pattern);
  lines.forEach((text, index) => {
    if (inScope(index + 1) && pattern.test(text)) report(index + 1, ruler.message ?? `matches ${ruler.pattern}`);
  });
  return found;
}

// Everything the rulers find in the added lines, plus legacy entries that
// now comply and must leave the list.
export function judge(config, byFile, read) {
  const problems = [];
  for (const ruler of config.rulers ?? []) {
    for (const [file, judged] of byFile) {
      if (!matchesAny(file, ruler.files) || (ruler.legacy ?? []).includes(file) || judged.size === 0) continue;
      const text = read(file);
      if (text === null) continue;
      for (const found of violations(ruler, text.split("\n"), judged)) problems.push(`${file}:${found.line} [${ruler.name}] ${found.message}`);
    }
    for (const file of ruler.legacy ?? []) {
      const text = read(file);
      if (text !== null && violations(ruler, text.split("\n")).length === 0) {
        problems.push(`${file} [${ruler.name}] complies now: remove it from "legacy" in tools/rulers.json (the list only shrinks)`);
      }
    }
  }
  return problems;
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 256 * 1024 * 1024 });
}

function option(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

function main() {
  const args = process.argv.slice(2);
  const config = JSON.parse(readFileSync(path.join(path.dirname(scriptFile), "rulers.json"), "utf8"));
  const branch = git(["branch", "--show-current"]).trim();
  if ((config.skipBranches ?? []).includes(branch)) {
    console.log(`rulers: ${branch} collects work already judged in its own pull requests; no verdict.`);
    return 0;
  }
  const base = option(args, "--base") ?? process.env.CHECKS_BASE ?? config.base ?? "origin/main";
  let mergeBase;
  try {
    mergeBase = git(["merge-base", base, "HEAD"]).trim();
  } catch {
    console.error(`rulers: cannot find ${base} to compare with. Fetch it, or pass --base <branch>.`);
    return 1;
  }
  const byFile = addedLines(git(["diff", "-M", "--unified=0", "--no-color", mergeBase]));
  const untracked = git(["ls-files", "--others", "--exclude-standard"]).split("\n").filter(Boolean);
  withUntracked(byFile, untracked.map((file) => ({ file, lineCount: readFileSync(file, "utf8").split("\n").length })));

  const scoped = [...byFile.keys()].filter((file) => (config.rulers ?? []).some((ruler) => matchesAny(file, ruler.files)));
  if (scoped.length > (config.maxFiles ?? 250)) {
    console.log(`rulers: ${scoped.length} files in scope is wider than one change (${config.maxFiles ?? 250}); no verdict.`);
    return 0;
  }
  const read = (file) => (existsSync(file) ? readFileSync(file, "utf8") : null);
  const problems = judge(config, byFile, read);
  if (problems.length === 0) {
    console.log(`rulers: ${scoped.length} changed file(s) follow ${(config.rulers ?? []).length} ruler(s).`);
    return 0;
  }
  console.error(`rulers: ${problems.length} problem(s) in the lines this change added:`);
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
    console.error(`rulers: ${error.message}`);
    process.exitCode = 1;
  }
}
