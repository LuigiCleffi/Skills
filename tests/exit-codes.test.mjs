import assert from "node:assert/strict";
import { readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { after, describe, it } from "node:test";
import { cleanUp, makeProject, run, templateDirectory, write } from "./helpers.mjs";

after(cleanUp);

// ROOT-02 in AGENTS.md: a script that cannot finish exits 2 with the reason on
// stderr, so CI can tell a broken check (2) from a check that found problems
// (1). A hook where 2 would block the session reports and lets it through.

const SCRIPT_FOLDERS = ["checks", "guards", "harness", "tools"];

const remove = (file) => (project) => rmSync(path.join(project, file));
const breakJson = (file) => (project) => write(project, file, "{ broken");
const hookInput = JSON.stringify({ tool_name: "Read", tool_input: { file_path: "README.md" } });

// One way to break each script (none of these projects is a git repository),
// the exit code it must give, and what its stderr must start with.
const BREAKS = {
  "checks/checks.mjs": { prepare: remove("checks/config.json"), code: 2, stderr: /^checks: / },
  "checks/checks.mjs hook": { prepare: remove("checks/config.json"), args: ["hook"], input: "{}", code: 0, stderr: /^$/ },
  "guards/guard.mjs": { prepare: breakJson("guards/config.json"), input: hookInput, code: 0, stderr: /^Guard failed: / },
  "harness/gate.mjs": { prepare: breakJson("harness/config.json"), args: ["status"], code: 2, stderr: /^gate: / },
  "harness/gate.mjs hook": { prepare: breakJson("harness/config.json"), input: hookInput, code: 1, stderr: /^gate: / },
  "tools/context-audit.mjs": { prepare: breakJson("tools/context-audit.json"), code: 2, stderr: /^tools\/context-audit\.json is not valid JSON/ },
  "tools/cycle-metrics.mjs": { args: ["--since", "not-a-date"], code: 2, stderr: /^cycle-metrics: / },
  "tools/doctor.mjs": { prepare: remove("tools/doctor.json"), code: 2, stderr: /^doctor: / },
  "tools/kit-update.mjs": { code: 0, stderr: /^$/ },
  "tools/mermaid-check.mjs": { code: 2, stderr: /^mermaid-check: / },
  "tools/palette-check.mjs": { prepare: remove("tools/palette.json"), code: 2, stderr: /^palette-check: / },
  "tools/review-context.mjs": { args: ["main"], code: 2, stderr: /^review-context: / },
  "tools/rulers.mjs": { prepare: remove("tools/rulers.json"), code: 2, stderr: /^rulers: / },
  "tools/rules-check.mjs": { prepare: remove("tools/rules-check.json"), code: 2, stderr: /^rules-check: / },
  "tools/worktree-slot.mjs": { code: 2, stderr: /^worktree-slot: / },
  "tools/worktree-slot.mjs --hook": { args: ["--hook"], code: 0, stderr: /^$/ },
};

function installedScripts() {
  return SCRIPT_FOLDERS.flatMap((folder) =>
    readdirSync(path.join(templateDirectory, folder))
      .filter((name) => name.endsWith(".mjs"))
      .map((name) => `${folder}/${name}`),
  ).sort();
}

const scriptOf = (name) => name.split(" ")[0];

describe("exit codes when a script cannot finish (ROOT-02)", () => {
  it("breaks every installed script", () => {
    assert.deepEqual([...new Set(Object.keys(BREAKS).map(scriptOf))].sort(), installedScripts());
  });

  for (const [name, broken] of Object.entries(BREAKS)) {
    it(`${name} exits ${broken.code}`, () => {
      const project = makeProject(SCRIPT_FOLDERS);
      broken.prepare?.(project);
      const result = run(project, scriptOf(name), broken.args ?? [], broken.input ?? "");
      assert.equal(result.code, broken.code, result.stderr);
      assert.match(result.stderr, broken.stderr);
    });
  }
});
