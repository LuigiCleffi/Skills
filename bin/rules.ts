// Capture mode of actions/knowledge.md: one file per business rule, plus its
// routing and register rows in the knowledge gate, in one change.

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { findTable, formatRow, insertLine } from "./markdown.js";

export type RuleInput = {
  statement: string;
  details?: string;
  context: string;
  source: string;
  status: "Proposed" | "Confirmed";
  confirmedBy?: string;
  examples: { situation: string; outcome: string }[];
  rationale?: string;
  subject: string;
  keywords: string[];
  paths: string[];
};

const knowledgeDirectory = "docs/knowledge";

const emptyGate = `# Knowledge Base — Gate

Read this file before specifying, modeling, implementing, or reviewing
behavior. Find every row whose "About" or "Paths" matches the task, then
read only those files. Confirmed rules are binding; a change to one goes
to the user.

Glossary: [glossary.md](glossary.md)

## Routing

| About… | Keywords | Paths | Read |
|---|---|---|---|

## Register

| ID | Title | Kind | Status | Updated |
|---|---|---|---|---|
`;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .split("-")
    .slice(0, 6)
    .join("-");
}

// Table cells cannot hold a pipe or a line break.
function cell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ").trim();
}

async function nextRuleNumber(rulesDirectory: string): Promise<number> {
  const files = await readdir(rulesDirectory).catch(() => [] as string[]);
  const numbers = files
    .map((file) => /^BR-(\d+)/.exec(file)?.[1])
    .filter((value): value is string => value !== undefined)
    .map(Number);
  return Math.max(0, ...numbers) + 1;
}

function ruleDocument(id: string, rule: RuleInput): string {
  const examples = rule.examples
    .map((example) => formatRow([cell(example.situation), cell(example.outcome)]))
    .join("\n");
  const confirmed = rule.status === "Confirmed" ? `${rule.confirmedBy}, ${today()}` : "";

  return `# ${id}: ${rule.statement}

**Status:** ${rule.status}
**Context:** ${rule.context}
**Source:** ${rule.source}
**Confirmed by:** ${confirmed}
**Updated:** ${today()}

## Statement
${rule.details ?? rule.statement}

## Examples
| Situation | Expected outcome |
|---|---|
${examples}

## Exceptions
None recorded.

## Rationale
${rule.rationale ?? "Rationale not recorded."}

## Where it is enforced
- Not yet linked. Add the spec, model, scenarios, and code that enforce this rule.

## Gate entries
${formatRow([cell(rule.subject), rule.keywords.map(cell).join(", "), rule.paths.map((p) => `\`${p}\``).join(", "), id])}
`;
}

// Adds the rule's link to the routing row for its subject, or a new row.
function addRoute(gate: string, rule: RuleInput, link: string): string {
  const table = findTable(gate, "Routing");
  if (table === null) throw new Error('The knowledge gate has no "## Routing" table.');

  const lines = gate.split("\n");
  const firstRow = table.lastLine - table.rows.length + 1;
  const existing = table.rows.findIndex(
    (cells) => cells[0]?.toLowerCase() === rule.subject.toLowerCase(),
  );

  if (existing === -1) {
    const row = formatRow([
      cell(rule.subject),
      rule.keywords.map(cell).join(", "),
      rule.paths.map((p) => `\`${p}\``).join(", "),
      link,
    ]);
    return insertLine(gate, table.lastLine, row);
  }

  const cells = [...table.rows[existing]];
  const keywords = new Set([
    ...cells[1].split(",").map((keyword) => keyword.trim()).filter(Boolean),
    ...rule.keywords.map(cell),
  ]);
  const paths = new Set([
    ...[...cells[2].matchAll(/`([^`]+)`/g)].map((match) => match[1]),
    ...rule.paths,
  ]);
  cells[1] = [...keywords].join(", ");
  cells[2] = [...paths].map((p) => `\`${p}\``).join(", ");
  cells[cells.length - 1] = [cells[cells.length - 1], link].filter(Boolean).join(", ");
  lines[firstRow + existing] = formatRow(cells);
  return lines.join("\n");
}

function addRegisterRow(gate: string, id: string, file: string, rule: RuleInput): string {
  const table = findTable(gate, "Register");
  if (table === null) throw new Error('The knowledge gate has no "## Register" table.');

  const row = formatRow([`[${id}](${file})`, cell(rule.statement), "Rule", rule.status, today()]);
  return insertLine(gate, table.lastLine, row);
}

// Writes the rule and updates the gate; returns the rule's path.
export async function captureRule(projectDirectory: string, rule: RuleInput): Promise<string> {
  if (rule.status === "Confirmed" && !rule.confirmedBy?.trim()) {
    throw new Error("A Confirmed rule needs confirmedBy: the decider who confirmed it.");
  }
  if (rule.examples.length === 0) {
    throw new Error("Add at least one example, including the boundary case.");
  }

  const baseDirectory = path.join(projectDirectory, knowledgeDirectory);
  const rulesDirectory = path.join(baseDirectory, "rules");
  await mkdir(rulesDirectory, { recursive: true });

  const id = `BR-${String(await nextRuleNumber(rulesDirectory)).padStart(4, "0")}`;
  const file = `rules/${id}-${slugify(rule.statement)}.md`;

  const gatePath = path.join(baseDirectory, "README.md");
  const gate = await readFile(gatePath, "utf8").catch(() => emptyGate);
  const updatedGate = addRegisterRow(addRoute(gate, rule, `[${id}](${file})`), id, file, rule);

  await writeFile(path.join(baseDirectory, file), ruleDocument(id, rule), "utf8");
  await writeFile(gatePath, updatedGate, "utf8");

  return path.posix.join(knowledgeDirectory, file);
}
