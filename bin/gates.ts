// The knowledge gate and the ADR gate, read the way actions/knowledge.md and
// actions/adr.md describe: match the task against the routing table, then
// return only the records the matching rows point to.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { codeSpans, findTable, globToRegExp, markdownLinks } from "./markdown.js";

export type GateName = "knowledge" | "adr";

export const gateFiles: Record<GateName, string> = {
  knowledge: "docs/knowledge/README.md",
  adr: "docs/adr/README.md",
};

const maxRecordLength = 20_000;

const ignoredWords = new Set([
  "about", "add", "adds", "and", "change", "changes", "create", "for", "from",
  "into", "make", "new", "or", "set", "that", "the", "this", "use", "when", "with",
]);

type RouteMatch = { row: string; reasons: string[]; records: string[] };

async function readIfExists(file: string): Promise<string | null> {
  try {
    return await readFile(file, "utf8");
  } catch {
    return null;
  }
}

function columnIndex(header: string[], name: string): number {
  return header.findIndex((cell) => cell.toLowerCase().includes(name));
}

// Drops a plural ending so "refund" matches "refunds" and "policies" "policy".
function stem(word: string): string {
  if (word.endsWith("ies") && word.length > 4) return `${word.slice(0, -3)}y`;
  if (word.endsWith("es") && /(s|x|z|ch|sh)es$/.test(word)) return word.slice(0, -2);
  if (word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 4 && !ignoredWords.has(word));
}

// Compares two texts by their stemmed words, ignoring short and common ones.
function sharedWords(row: string, query: string): string[] {
  const queryStems = new Set(words(query).map(stem));
  return words(row).filter((word) => queryStems.has(stem(word)));
}

function matchReasons(
  cells: string[],
  header: string[],
  query: string,
  paths: string[],
): string[] {
  const reasons: string[] = [];
  const keywordCell = cells[columnIndex(header, "keyword")] ?? "";
  const pathCell = cells[columnIndex(header, "path")] ?? "";

  const keywords = keywordCell
    .split(",")
    .map((keyword) => keyword.trim().toLowerCase())
    .filter(Boolean);
  const hitKeywords = keywords.filter(
    (keyword) => query.includes(keyword) || sharedWords(keyword, query).length > 0,
  );
  if (hitKeywords.length > 0) reasons.push(`keywords: ${hitKeywords.join(", ")}`);

  const hitWords = sharedWords(cells[0] ?? "", query);
  if (hitWords.length > 0) reasons.push(`subject: ${hitWords.join(", ")}`);

  const globs = codeSpans(pathCell);
  const hitPaths = paths.filter((file) => globs.some((glob) => globToRegExp(glob).test(file)));
  if (hitPaths.length > 0) reasons.push(`paths: ${hitPaths.join(", ")}`);

  return reasons;
}

async function readRecord(gateDirectory: string, target: string): Promise<string> {
  const content = await readIfExists(path.resolve(gateDirectory, target));
  if (content === null) return `(missing: ${target} — the gate points to a file that does not exist)`;
  return content.length > maxRecordLength
    ? `${content.slice(0, maxRecordLength)}\n\n(truncated; read the file for the rest)`
    : content;
}

async function glossaryMatches(projectDirectory: string, query: string): Promise<string[]> {
  const glossary = await readIfExists(path.join(projectDirectory, "docs/knowledge/glossary.md"));
  if (glossary === null) return [];

  return glossary
    .split("\n")
    .filter((line) => line.trim().startsWith("|"))
    .filter((line) => {
      const term = line.split("|")[1]?.trim().toLowerCase() ?? "";
      return term.length > 0 && term !== "term" && !term.startsWith("-") && query.includes(term);
    });
}

// Returns the gate's answer for the task, as text for the agent.
export async function consultGate(
  projectDirectory: string,
  gate: GateName,
  about: string,
  paths: string[],
): Promise<string> {
  const gateFile = path.join(projectDirectory, gateFiles[gate]);
  const document = await readIfExists(gateFile);

  if (document === null) {
    return `${gate === "adr" ? "ADR" : "Knowledge"} gate: no records yet (${gateFiles[gate]} does not exist).`;
  }

  const table = findTable(document, "Routing");
  if (table === null) {
    return `${gateFiles[gate]} has no "## Routing" table. Read it directly:\n\n${document}`;
  }

  const query = about.toLowerCase();
  const relativePaths = paths.map((file) =>
    path.relative(projectDirectory, path.resolve(projectDirectory, file)).split(path.sep).join("/"),
  );
  const readColumn = columnIndex(table.header, "read");

  const matches: RouteMatch[] = table.rows
    .map((cells) => ({
      row: cells[0] ?? "",
      reasons: matchReasons(cells, table.header, query, relativePaths),
      records: markdownLinks(cells[readColumn] ?? "").map((link) => link.target),
    }))
    .filter((match) => match.reasons.length > 0);

  const sections: string[] = [];

  if (matches.length === 0) {
    sections.push(
      `No routing row matched "${about}". Check the routing table yourself; when in doubt, read the row's records.\n\n${document}`,
    );
  } else {
    const gateDirectory = path.dirname(gateFile);
    const targets = [...new Set(matches.flatMap((match) => match.records))];

    sections.push(
      "Matched routing rows:",
      ...matches.map((match) => `- ${match.row} (${match.reasons.join("; ")}) → ${match.records.join(", ")}`),
    );

    for (const target of targets) {
      sections.push(`\n---\n# ${target}\n\n${await readRecord(gateDirectory, target)}`);
    }
  }

  if (gate === "knowledge") {
    const terms = await glossaryMatches(projectDirectory, query);
    if (terms.length > 0) sections.push("\nGlossary terms in the task:", ...terms);
  }

  return sections.join("\n");
}
