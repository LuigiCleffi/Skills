import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { templateDirectory } from "./helpers.mjs";

// ROOT-03 in AGENTS.md: the Scrum approvals are called by name, never by a bare
// code. Users read "waiting for G4" and could not tell what was asked of them.

const GATE_CODE = /\bG[1-4]\b/;

function markdownFiles(folder) {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) return markdownFiles(full);
    return entry.name.endsWith(".md") ? [full] : [];
  });
}

describe("Scrum templates name approvals in plain words", () => {
  for (const file of markdownFiles(path.join(templateDirectory, "scrum"))) {
    it(path.relative(templateDirectory, file), () => {
      const offending = readFileSync(file, "utf8")
        .split("\n")
        .map((line, index) => ({ line, number: index + 1 }))
        .filter(({ line }) => GATE_CODE.test(line));
      assert.deepEqual(offending, [], "use the approval's name (for example \"commit approval\"), not a gate code");
    });
  }
});
