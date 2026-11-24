import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { after, describe, it } from "node:test";
import { cleanUp, git, importFrom, makeProject, run, write } from "./helpers.mjs";

after(cleanUp);

const diff = [
  "diff --git a/src/a.ts b/src/a.ts",
  "--- a/src/a.ts",
  "+++ b/src/a.ts",
  "@@ -1,2 +1,3 @@",
  " const a = 1;",
  "+const b: any = 2;",
  " const c = 3;",
  "@@ -10,0 +11,2 @@",
  "+// x",
  "+// y",
  "diff --git a/old.ts b/old.ts",
  "--- a/old.ts",
  "+++ /dev/null",
  "@@ -1 +0,0 @@",
  "-gone",
].join("\n");

describe("rulers", () => {
  it("reads the added line numbers from a diff, and counts untracked files as all added", async () => {
    const rulers = await importFrom(makeProject(["tools"]), "tools/rulers.mjs");
    const byFile = rulers.addedLines(diff);
    assert.deepEqual([...byFile.get("src/a.ts")], [2, 11, 12]);
    assert.equal(byFile.has("old.ts"), false);
    rulers.withUntracked(byFile, [{ file: "src/new.ts", lineCount: 3 }]);
    assert.deepEqual([...byFile.get("src/new.ts")], [1, 2, 3]);
  });

  it("judges only added lines, accepts an opt-out with a reason, and refuses one without", async () => {
    const rulers = await importFrom(makeProject(["tools"]), "tools/rulers.mjs");
    const ruler = { name: "any-type", files: ["**/*.ts"], pattern: "(:\\s*any\\b|\\bas any\\b)", allow: "ruler:allow-any" };
    const lines = [
      "const old: any = 1;",
      "const b: any = 2;",
      "// ruler:allow-any — the SDK returns any",
      "const c = sdk() as any;",
      "const d = x as any; // ruler:allow-any",
    ];
    assert.deepEqual(rulers.violations(ruler, lines, new Set([2, 3, 4, 5])), [
      { line: 2, message: "matches (:\\s*any\\b|\\bas any\\b)" },
      { line: 5, message: "ruler:allow-any needs a reason after it" },
    ]);
  });

  it("finds long comment blocks, and makes the legacy list shrink", async () => {
    const rulers = await importFrom(makeProject(["tools"]), "tools/rulers.mjs");
    const block = { name: "long-comments", kind: "comment-block", files: ["**/*.ts"], maxLines: 2, legacy: ["src/legacy.ts", "src/clean.ts"] };
    const files = {
      "src/a.ts": "// one\n// two\n// three\ncode();\n// short\n",
      "src/legacy.ts": "// a\n// b\n// c\n",
      "src/clean.ts": "code();\n",
    };
    const byFile = new Map([["src/a.ts", new Set([1, 2, 3, 4, 5])], ["src/legacy.ts", new Set([1, 2, 3])]]);
    assert.deepEqual(rulers.judge({ rulers: [block] }, byFile, (file) => files[file] ?? null), [
      "src/a.ts:1 [long-comments] 3 lines of comment (at most 2): say it in fewer lines, or in the commit or the docs",
      'src/clean.ts [long-comments] complies now: remove it from "legacy" in tools/rulers.json (the list only shrinks)',
    ]);
  });

  it("checks a real branch against its base, untracked files included", () => {
    const project = makeProject(["tools"]);
    writeFileSync(path.join(project, "tools/rulers.json"), JSON.stringify({
      base: "main",
      rulers: [{ name: "any-type", files: ["**/*.ts"], pattern: ":\\s*any\\b", allow: "ruler:allow-any" }],
    }));
    write(project, "src/old.ts", "const legacy: any = 1;\n");
    git(project, "init", "-q", "-b", "main");
    git(project, "-c", "user.email=t@t", "-c", "user.name=t", "add", "-A");
    git(project, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "base");
    git(project, "checkout", "-qb", "feature");
    assert.equal(run(project, "tools/rulers.mjs").code, 0);
    write(project, "src/new.ts", "export const fresh: any = 2;\n");
    const result = run(project, "tools/rulers.mjs");
    assert.equal(result.code, 1);
    assert.match(result.stderr, /src\/new\.ts:1 \[any-type\]/);
    assert.doesNotMatch(result.stderr, /old\.ts/);
    assert.equal(run(project, "tools/rulers.mjs", [], "", { CHECKS_BASE: "feature" }).code, 1);
  });
});

describe("when it cannot run", () => {
  it("exits 2 with the reason outside git, never 1", () => {
    const result = run(makeProject(["tools"]), "tools/rulers.mjs");
    assert.equal(result.code, 2);
    assert.match(result.stderr, /^rulers: /);
  });
});
