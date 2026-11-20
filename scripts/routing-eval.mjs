#!/usr/bin/env node
//
// Routing eval: does an agent open the right workflow for a request?
//
// The kit routes by description: each workflow's frontmatter says when to use
// it, and the agent picks from those lines. A new workflow or a reworded
// description can steal requests from another one, and nothing else notices.
// This eval asks a model to route each request in evals/routing/corpus.json
// using only the descriptions, and scores the answers.
//
// Usage:
//   npm run eval:routing                       # run, compare with the baseline, fail below the bar
//   npm run eval:routing -- --write-baseline   # run and save the result as the new baseline
//   npm run eval:routing -- --dry-run          # print the catalog and one prompt; calls nothing
//   npm run eval:routing -- --model <name>     # passed to the claude CLI as --model
//
// It runs the Claude Code CLI (`claude -p`), so it uses your Claude Code login
// and costs one short request per case. Run it when a description changes or a
// workflow is added; it is not part of npm test because it calls a model.
//
// The bar: accuracy >= 0.90,
// >= 0.80 on the cases that have a workflow, and no cross-fire (a request sent
// to the wrong workflow). A drop of more than 0.05 from the baseline also fails.

import { execFile } from "node:child_process";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const repoDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const templateDirectory = path.join(repoDirectory, "templates");
const corpusFile = path.join(repoDirectory, "evals/routing/corpus.json");
const baselineFile = path.join(repoDirectory, "evals/routing/baseline.json");

const bar = { accuracy: 0.9, positives: 0.8, crossFire: 0, maxDrop: 0.05 };
const concurrency = 4;

// The workflows an agent routes to: every entry point with a description.
const catalogRoots = ["actions", "ProductDefinition/specs", "scrum/README.md"];

async function filesUnder(relative) {
  const absolute = path.join(templateDirectory, relative);
  if (relative.endsWith(".md")) return [relative];
  const entries = await readdir(absolute, { withFileTypes: true });
  return entries.filter((entry) => entry.isFile() && entry.name.endsWith(".md")).map((entry) => path.posix.join(relative, entry.name));
}

export async function loadCatalog() {
  const files = (await Promise.all(catalogRoots.map(filesUnder))).flat().sort();
  const catalog = [];
  for (const file of files) {
    const document = await readFile(path.join(templateDirectory, file), "utf8");
    const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(document)?.[1];
    const description = frontmatter ? parse(frontmatter)?.description : undefined;
    if (typeof description === "string") catalog.push({ file, description });
  }
  return catalog;
}

export function routingPrompt(catalog, request) {
  return [
    "You route requests in a software project to the one workflow file an AI coding agent should open first.",
    "Each workflow below has a path and a description of when to use it.",
    "",
    ...catalog.map(({ file, description }) => `- ${file}: ${description}`),
    "",
    "If no workflow applies (a question, a docs-only edit, a task unrelated to building software), answer none.",
    "Answer with exactly one path from the list, or none. No other words.",
    "",
    `Request: ${request}`,
  ].join("\n");
}

export function normalizeAnswer(answer, catalog) {
  const text = answer.trim().replace(/^`+|`+$/g, "").trim();
  if (/^none\.?$/i.test(text)) return "none";
  const match = catalog.find(({ file }) => text === file || text.endsWith(file) || text.includes(file));
  return match ? match.file : `unparsed: ${text.slice(0, 80)}`;
}

export function score(results) {
  const positives = results.filter((result) => result.expected !== "none");
  const correct = results.filter((result) => result.answer === result.expected);
  const crossFire = positives.filter((result) => result.answer !== result.expected && result.answer !== "none");
  const ratio = (part, whole) => (whole.length === 0 ? 1 : Number((part.length / whole.length).toFixed(3)));
  return {
    cases: results.length,
    accuracy: ratio(correct, results),
    positives: ratio(positives.filter((result) => result.answer === result.expected), positives),
    crossFire: crossFire.length,
    misses: results.filter((result) => result.answer !== result.expected),
  };
}

function askClaude(prompt, model) {
  const args = ["-p", prompt, "--output-format", "text", ...(model ? ["--model", model] : [])];
  return new Promise((resolve, reject) => {
    execFile("claude", args, { maxBuffer: 1024 * 1024, timeout: 120_000 }, (error, stdout, stderr) => {
      if (error) reject(new Error(error.code === "ENOENT" ? "The claude CLI is not on PATH." : stderr || error.message));
      else resolve(stdout);
    });
  });
}

async function runCases(cases, catalog, model) {
  const results = new Array(cases.length);
  let next = 0;
  const worker = async () => {
    while (next < cases.length) {
      const index = next++;
      const { prompt, expected } = cases[index];
      const answer = normalizeAnswer(await askClaude(routingPrompt(catalog, prompt), model), catalog);
      results[index] = { prompt, expected, answer };
      process.stderr.write(answer === expected ? "." : "x");
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, cases.length) }, worker));
  process.stderr.write("\n");
  return results;
}

function verdict(result, baseline) {
  const problems = [];
  if (result.accuracy < bar.accuracy) problems.push(`accuracy ${result.accuracy} < ${bar.accuracy}`);
  if (result.positives < bar.positives) problems.push(`positives ${result.positives} < ${bar.positives}`);
  if (result.crossFire > bar.crossFire) problems.push(`${result.crossFire} cross-fire(s)`);
  if (baseline && baseline.accuracy - result.accuracy > bar.maxDrop) {
    problems.push(`accuracy dropped ${(baseline.accuracy - result.accuracy).toFixed(3)} from the baseline of ${baseline.date}`);
  }
  return problems;
}

async function main() {
  const args = process.argv.slice(2);
  const modelFlag = args.indexOf("--model");
  const model = modelFlag === -1 ? undefined : args[modelFlag + 1];
  const { cases } = JSON.parse(await readFile(corpusFile, "utf8"));
  const catalog = await loadCatalog();

  const unknown = cases.filter((item) => item.expected !== "none" && !catalog.some(({ file }) => file === item.expected));
  if (unknown.length > 0) {
    throw new Error(`Corpus cases expect workflows with no description: ${unknown.map((item) => item.expected).join(", ")}`);
  }

  if (args.includes("--dry-run")) {
    console.log(`${catalog.length} workflows, ${cases.length} cases. First prompt:\n`);
    console.log(routingPrompt(catalog, cases[0].prompt));
    return 0;
  }

  const results = await runCases(cases, catalog, model);
  const result = { date: new Date().toISOString().slice(0, 10), model: model ?? "claude CLI default", ...score(results) };
  const baseline = await readFile(baselineFile, "utf8").then(JSON.parse, () => null);

  console.log(`accuracy ${result.accuracy} · positives ${result.positives} · cross-fire ${result.crossFire} · ${result.cases} cases`);
  for (const miss of result.misses) console.log(`  x "${miss.prompt}" → ${miss.answer} (expected ${miss.expected})`);

  if (args.includes("--write-baseline")) {
    await writeFile(baselineFile, `${JSON.stringify(result, null, 2)}\n`, "utf8");
    console.log(`Saved the baseline to ${path.relative(repoDirectory, baselineFile)}.`);
  }

  const problems = verdict(result, args.includes("--write-baseline") ? null : baseline);
  for (const problem of problems) console.error(`✖ ${problem}`);
  if (problems.length === 0) console.log("✔ Routing is within the bar.");
  return problems.length === 0 ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(
    (code) => (process.exitCode = code),
    (error) => {
      console.error(`routing-eval: ${error.message}`);
      process.exitCode = 1;
    },
  );
}
