import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { loadCatalog, normalizeAnswer, routingPrompt, score } from "../scripts/routing-eval.mjs";
import { repoDirectory } from "./helpers.mjs";

describe("routing eval", () => {
  it("has a described workflow for every case the corpus expects", async () => {
    const catalog = await loadCatalog();
    const files = new Set(catalog.map(({ file }) => file));
    const { cases } = JSON.parse(readFileSync(path.join(repoDirectory, "evals/routing/corpus.json"), "utf8"));
    for (const { expected } of cases) {
      if (expected !== "none") assert.ok(files.has(expected), expected);
    }
    assert.match(routingPrompt(catalog, "Add a refund button"), /actions\/harness\.md: Run a change/);
  });

  it("reads answers with backticks or extra words, and none", () => {
    const catalog = [{ file: "actions/tdd.md" }, { file: "actions/dev.md" }];
    assert.equal(normalizeAnswer("`actions/tdd.md`\n", catalog), "actions/tdd.md");
    assert.equal(normalizeAnswer("None.", catalog), "none");
    assert.match(normalizeAnswer("the tests one", catalog), /^unparsed/);
  });

  it("counts a wrong workflow as cross-fire and a missed one as a miss only", () => {
    const result = score([
      { prompt: "a", expected: "actions/tdd.md", answer: "actions/tdd.md" },
      { prompt: "b", expected: "actions/tdd.md", answer: "actions/dev.md" },
      { prompt: "c", expected: "actions/dev.md", answer: "none" },
      { prompt: "d", expected: "none", answer: "none" },
    ]);
    assert.deepEqual([result.accuracy, result.positives, result.crossFire, result.misses.length], [0.5, 0.333, 1, 2]);
  });
});
