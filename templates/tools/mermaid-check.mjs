#!/usr/bin/env node
//
// Mermaid check: parses every ```mermaid block in Markdown files with the
// real Mermaid parser, so a broken diagram fails here instead of rendering as
// an error box in a pull request or a doc site.
//
// Usage:
//   node tools/mermaid-check.mjs                       # every tracked .md file
//   node tools/mermaid-check.mjs docs/a.md docs/b.md   # these files
//   node tools/mermaid-check.mjs --changed [--base origin/main]   # .md files the branch changed
//
// Exit codes: 0 every diagram parses · 1 a diagram is broken (file, line, and
// Mermaid's message) · 2 the check cannot run: it needs the project's own
// `mermaid` and `jsdom` packages (npm install -D mermaid jsdom).
//
// As a check before a pull request, in checks/config.json:
//   { "name": "diagrams", "command": "node tools/mermaid-check.mjs --changed", "when": ["**/*.md"] }

import { execFileSync } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptFile = fileURLToPath(import.meta.url);
const CANNOT_RUN = 2;

// The ```mermaid (or ~~~mermaid) blocks of a Markdown text, with the line of
// each opening fence. A fence closes only with the same character, at least as
// long as it opened.
export function mermaidBlocks(text) {
  const blocks = [];
  let open = null;
  text.split("\n").forEach((line, index) => {
    const marker = /^ {0,3}(`{3,}|~{3,})\s*([\w-]*)/.exec(line);
    if (open) {
      if (marker && marker[1][0] === open.fence[0] && marker[1].length >= open.fence.length && line.trim() === marker[1]) {
        if (open.mermaid) blocks.push({ line: open.line, source: open.lines.join("\n") });
        open = null;
      } else {
        open.lines.push(line);
      }
      return;
    }
    if (marker) open = { fence: marker[1], mermaid: marker[2].toLowerCase() === "mermaid", line: index + 1, lines: [] };
  });
  return blocks;
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).split("\n").filter(Boolean);
}

function filesToCheck(args) {
  const files = args.filter((arg, index) => !arg.startsWith("--") && args[index - 1] !== "--base");
  if (files.length > 0) return files;
  if (args.includes("--changed")) {
    const baseIndex = args.indexOf("--base");
    const base = baseIndex === -1 ? "origin/main" : args[baseIndex + 1];
    const mergeBase = git(["merge-base", base, "HEAD"])[0];
    return git(["diff", "--name-only", "--diff-filter=d", `${mergeBase}...HEAD`]).filter((file) => file.endsWith(".md"));
  }
  return git(["ls-files", "*.md"]);
}

// The project's own mermaid and jsdom, or null when either is missing.
async function loadParser(cwd) {
  const require = createRequire(path.join(cwd, "package.json"));
  let mermaidPath;
  let jsdom;
  try {
    mermaidPath = require.resolve("mermaid");
    jsdom = require("jsdom");
  } catch {
    return null;
  }
  const { window } = new jsdom.JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true });
  for (const name of ["window", "document", "navigator", "DOMParser", "Element", "HTMLElement", "SVGElement"]) {
    if (globalThis[name] === undefined && window[name] !== undefined) {
      Object.defineProperty(globalThis, name, { value: name === "window" ? window : window[name], configurable: true, writable: true });
    }
  }
  const mermaid = (await import(pathToFileURL(mermaidPath).href)).default;
  mermaid.initialize({ startOnLoad: false });
  return (source) => mermaid.parse(source);
}

async function main() {
  const args = process.argv.slice(2);
  const files = filesToCheck(args);
  const blocks = files.flatMap((file) => mermaidBlocks(readFileSync(file, "utf8")).map((block) => ({ file, ...block })));
  if (blocks.length === 0) {
    console.log(`No Mermaid diagrams in ${files.length} file(s).`);
    return 0;
  }

  const parse = await loadParser(process.cwd());
  if (!parse) {
    console.error("mermaid-check: needs the project's mermaid and jsdom packages: npm install -D mermaid jsdom");
    return CANNOT_RUN;
  }

  const broken = [];
  for (const block of blocks) {
    try {
      await parse(block.source);
    } catch (error) {
      broken.push(`${block.file}:${block.line}: ${String(error.message ?? error).split("\n").slice(0, 3).join(" ")}`);
    }
  }
  if (broken.length === 0) {
    console.log(`${blocks.length} Mermaid diagram(s) parse.`);
    return 0;
  }
  console.error(`${broken.length} of ${blocks.length} Mermaid diagram(s) do not parse:`);
  for (const line of broken) console.error(`  - ${line}`);
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
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      console.error(`mermaid-check: ${error.message}`);
      process.exitCode = CANNOT_RUN;
    },
  );
}
