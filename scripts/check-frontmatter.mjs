#!/usr/bin/env node
//
// Fails when a template's YAML frontmatter would not parse, or lacks the
// name and description every skill needs. GitHub and agent runtimes reject
// the whole file when its frontmatter is invalid, so catch it before release.
//
// Usage:
//   node scripts/check-frontmatter.mjs [directory]   # defaults to templates/

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";

const root = process.argv[2] ?? "templates";
const frontmatterPattern = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/;

async function listMarkdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const entryPath = path.join(directory, entry.name);

      if (entry.isDirectory()) return listMarkdownFiles(entryPath);
      return entry.name.endsWith(".md") ? [entryPath] : [];
    }),
  );

  return nested.flat().sort();
}

function checkFrontmatter(content) {
  const match = content.match(frontmatterPattern);
  if (!match) return { problems: ["frontmatter has no closing --- line"] };

  let data;
  try {
    data = parse(match[1]);
  } catch (error) {
    // Quote a value that contains ": " or starts with a YAML indicator.
    return { problems: [`invalid YAML: ${error.message.split("\n")[0]}`] };
  }

  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return { problems: ["frontmatter must be a mapping of keys to values"] };
  }

  const problems = ["name", "description"]
    .filter((key) => typeof data[key] !== "string" || data[key].trim() === "")
    .map((key) => `missing or empty "${key}"`);

  return { name: data.name, problems };
}

const files = await listMarkdownFiles(root);
const failures = [];
const filesByName = new Map();
let checked = 0;

for (const file of files) {
  const content = await readFile(file, "utf8");
  if (!content.startsWith("---")) continue;

  checked += 1;
  const { name, problems } = checkFrontmatter(content);

  for (const problem of problems) failures.push(`${file}: ${problem}`);

  if (typeof name === "string") {
    filesByName.set(name, [...(filesByName.get(name) ?? []), file]);
  }
}

for (const [name, namedFiles] of filesByName) {
  if (namedFiles.length > 1) {
    failures.push(`duplicate skill name "${name}" in ${namedFiles.join(", ")}`);
  }
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`✖ ${failure}`);
  console.error(`\n${failures.length} frontmatter problem(s) in ${checked} skill files.`);
  process.exit(1);
}

console.log(`✔ ${checked} skill frontmatters are valid.`);
