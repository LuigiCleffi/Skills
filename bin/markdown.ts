// Small helpers for the Markdown tables the gates and records are kept in.

export type Table = {
  header: string[];
  rows: string[][];
  // Index of the last table line in the document, for inserting rows.
  lastLine: number;
};

export function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

export function formatRow(cells: string[]): string {
  return `| ${cells.join(" | ")} |`;
}

function isSeparator(line: string): boolean {
  return /^\|?\s*:?-{3,}/.test(line.trim());
}

// Reads the first table under the "## <heading>" section, or null.
export function findTable(document: string, heading: string): Table | null {
  const lines = document.split("\n");
  const headingIndex = lines.findIndex(
    (line) => line.trim().toLowerCase() === `## ${heading.toLowerCase()}`,
  );
  if (headingIndex === -1) return null;

  let start = headingIndex + 1;
  while (start < lines.length && !lines[start].trim().startsWith("|")) {
    if (lines[start].startsWith("## ")) return null;
    start += 1;
  }
  if (start >= lines.length) return null;

  let end = start;
  while (end + 1 < lines.length && lines[end + 1].trim().startsWith("|")) end += 1;

  const tableLines = lines.slice(start, end + 1);
  const body = tableLines.slice(1).filter((line) => !isSeparator(line));

  return { header: splitRow(tableLines[0]), rows: body.map(splitRow), lastLine: end };
}

export function insertLine(document: string, afterLine: number, line: string): string {
  const lines = document.split("\n");
  lines.splice(afterLine + 1, 0, line);
  return lines.join("\n");
}

export function markdownLinks(cell: string): { label: string; target: string }[] {
  return [...cell.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)].map((match) => ({
    label: match[1],
    target: match[2],
  }));
}

export function codeSpans(cell: string): string[] {
  return [...cell.matchAll(/`([^`]+)`/g)].map((match) => match[1]);
}

// Converts a glob with *, ** and ? into an anchored regular expression.
// Mirrors templates/harness/gate.mjs, which must stay dependency-free.
export function globToRegExp(glob: string): RegExp {
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
