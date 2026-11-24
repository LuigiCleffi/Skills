import assert from "node:assert/strict";
import { chmodSync, readdirSync, realpathSync, symlinkSync } from "node:fs";
import path from "node:path";
import { after, describe, it } from "node:test";
import { cleanUp, makeProject, run, templateDirectory, write } from "./helpers.mjs";

after(cleanUp);

// ROOT-01 in AGENTS.md: every installed script runs the same when called through
// a symlinked path (macOS /tmp and /var, symlinked CI workspaces) as through its
// real path. Node resolves symlinks in import.meta.url but not in process.argv[1],
// so an entry-point check that compares them unresolved does nothing, and the
// script exits 0 without running: a check that passes without checking.

const SCRIPT_FOLDERS = ["checks", "guards", "harness", "tools"];

// One invocation per script that prints something deterministic without the
// network, so "ran and printed" can be told from "did not run".
const INVOCATIONS = {
  "checks/checks.mjs": {},
  "guards/guard.mjs": { input: JSON.stringify({ tool_name: "Read", tool_input: { file_path: ".env" } }) },
  "harness/gate.mjs": { args: ["status"] },
  "tools/context-audit.mjs": { files: { "CLAUDE.md": "rules" } },
  "tools/cycle-metrics.mjs": { args: ["--since", "not-a-date"] },
  "tools/doctor.mjs": { files: { "tools/doctor.json": JSON.stringify({ checks: [{ name: "Node.js", run: "node --version" }] }) } },
  "tools/kit-update.mjs": {
    args: ["--check"],
    files: { ".skills-code-kit/lock.json": JSON.stringify({ version: "1.0.0", groups: ["dev"] }), "fakebin/npm": "#!/bin/sh\necho 9.9.9\n" },
    fakeNpm: true,
  },
  "tools/mermaid-check.mjs": {},
  "tools/palette-check.mjs": {},
  "tools/review-context.mjs": {},
  "tools/rulers.mjs": {},
  "tools/rules-check.mjs": {},
  "tools/worktree-slot.mjs": {},
};

function installedScripts() {
  return SCRIPT_FOLDERS.flatMap((folder) =>
    readdirSync(path.join(templateDirectory, folder))
      .filter((name) => name.endsWith(".mjs"))
      .map((name) => `${folder}/${name}`),
  ).sort();
}

// A fresh project with the installed scripts and the invocation's files.
function projectFor(invocation) {
  const directory = makeProject(SCRIPT_FOLDERS);
  for (const [file, content] of Object.entries(invocation.files ?? {})) write(directory, file, content);
  if (invocation.fakeNpm) chmodSync(path.join(directory, "fakebin/npm"), 0o755);
  return directory;
}

function runIn(directory, script, invocation) {
  const env = invocation.fakeNpm ? { PATH: `${path.join(directory, "fakebin")}${path.delimiter}${process.env.PATH}` } : {};
  const result = run(directory, script, invocation.args ?? [], invocation.input ?? "", env);
  // Scripts may print the link path or the real path behind it; both are the project.
  const normalize = (text) => text.split(directory).join("<project>").split(realpathSync(directory)).join("<project>");
  return { code: result.code, stdout: normalize(result.stdout), stderr: normalize(result.stderr) };
}

describe("entry points (ROOT-01)", () => {
  it("has an invocation for every installed script", () => {
    assert.deepEqual(Object.keys(INVOCATIONS).sort(), installedScripts());
  });

  for (const [script, invocation] of Object.entries(INVOCATIONS)) {
    it(`${script} runs the same through a symlinked path`, () => {
      const direct = runIn(projectFor(invocation), script, invocation);
      assert.ok(direct.stdout || direct.stderr, "the invocation must print something, or a script that did not run would pass");

      const link = path.join(makeProject(), "link");
      symlinkSync(projectFor(invocation), link);
      assert.deepEqual(runIn(link, script, invocation), direct);
    });
  }
});
