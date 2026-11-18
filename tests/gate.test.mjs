import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { cleanUp, importFrom, makeProject, run, write } from "./helpers.mjs";

after(cleanUp);

const goodModel = `# Domain Model: Refunds

## 1. Bounded Context
Billing.

## 2. Ubiquitous Language
| Term | Meaning |

## 4. Invariants
DM-01 a refund never exceeds the payment.

## 8. Decisions Log and Open Questions
**Open Questions: None.**
`;

function activeRun(project, state) {
  write(project, "docs/harness/active.json", JSON.stringify({ run: "docs/harness/runs/r.md", records: {}, ...state }));
}

function settled(stages) {
  return Object.fromEntries(stages.map((stage) => [stage, "skipped: not needed in this test"]));
}

describe("enforcement", () => {
  it("defaults to warn and reads the older true and false values", async () => {
    const gate = await importFrom(makeProject(["harness"]), "harness/gate.mjs");
    assert.equal(gate.enforcement({}, {}), "warn");
    assert.equal(gate.enforcement({ enforce: true }, {}), "block");
    assert.equal(gate.enforcement({ enforce: false }, {}), "off");
    assert.equal(gate.enforcement({ enforce: "block" }, { HARNESS_GATE: "warn" }), "warn");
  });

  it("ships warning by default", async () => {
    const gate = await importFrom(makeProject(["harness"]), "harness/gate.mjs");
    assert.equal(gate.loadConfig().enforce, "warn");
  });
});

describe("depth by trigger", () => {
  it("keeps a run light without triggers and adds the triggered stages with one", async () => {
    const gate = await importFrom(makeProject(["harness"]), "harness/gate.mjs");
    const config = gate.loadConfig();
    assert.ok(!gate.requiredStages(config, "feature", []).includes("ddd"));
    const deep = gate.requiredStages(config, "feature", ["schema"]);
    assert.ok(deep.includes("ddd"));
    assert.ok(deep.indexOf("ddd") < deep.indexOf("bdd"), "stages keep the workflow order");
    assert.deepEqual(gate.requiredStages(config, "fix", ["concurrency"]), [
      "spec",
      "reproduce",
      "ddd",
      "knowledge-gate",
      "adr-gate",
      "tasks",
    ]);
  });

  it("still reads a mode written as a plain list", async () => {
    const gate = await importFrom(makeProject(["harness"]), "harness/gate.mjs");
    assert.deepEqual(gate.requiredStages({ modes: { chore: ["adr-gate"] } }, "chore", ["schema"]), ["adr-gate"]);
    assert.equal(gate.requiredStages({ modes: {} }, "feature"), null);
  });

  it("reports a trigger the edited path hits but the run did not declare", async () => {
    const project = makeProject(["harness"]);
    const gate = await importFrom(project, "harness/gate.mjs");
    const config = gate.loadConfig();
    activeRun(project, { mode: "chore", stages: settled(["adr-gate"]) });

    assert.equal(gate.evaluateRun(config).ready, true);
    const touched = gate.evaluateRun(config, ["src/db/migrations/001_add.sql"]);
    assert.equal(touched.ready, false);
    assert.match(touched.problems[0], /trigger schema .* not declare/);
  });
});

describe("record checks", () => {
  it("accepts a record that has what its stage requires", async () => {
    const project = makeProject(["harness"]);
    const gate = await importFrom(project, "harness/gate.mjs");
    write(project, "specs/DomainModel.md", goodModel);
    assert.deepEqual(gate.recordProblems(gate.loadConfig(), "ddd", "specs/DomainModel.md"), []);
    assert.equal(gate.stageProblem("ddd", "done", "specs/DomainModel.md", gate.loadConfig()), null);
  });

  it("names each missing heading, open question, placeholder, and word over budget", async () => {
    const project = makeProject(["harness"]);
    const gate = await importFrom(project, "harness/gate.mjs");
    const config = gate.loadConfig();
    write(project, "specs/DomainModel.md", "# Domain Model: [FEATURE NAME]\n\n## 1. Bounded Context\n");
    const problems = gate.recordProblems(config, "ddd", "specs/DomainModel.md");
    assert.ok(problems.some((p) => p.includes('"Invariants"')));
    assert.ok(problems.some((p) => p.includes("Open Questions: None.")));
    assert.ok(problems.some((p) => p.includes("[FEATURE NAME]")));

    write(project, "plan.md", `Open Questions: None.\n${"word ".repeat(1600)}`);
    assert.match(gate.recordProblems(config, "plan", "plan.md").join(), /1603 words, over the budget of 1500/);
  });

  it("refuses done without a record when the stage has checks, and reads a folder record", async () => {
    const project = makeProject(["harness"]);
    const gate = await importFrom(project, "harness/gate.mjs");
    const config = gate.loadConfig();
    assert.match(gate.stageProblem("ddd", "done", undefined, config), /names no record/);
    assert.equal(gate.stageProblem("research", "done", undefined, config), null);

    write(project, "features/refunds.feature", "Feature: Refunds\n  Scenario: full refund\n");
    assert.equal(gate.stageProblem("bdd", "done", "features", config), null);
  });

  it("validates from the command line", () => {
    const project = makeProject(["harness"]);
    write(project, "specs/DomainModel.md", goodModel);
    assert.equal(run(project, "harness/gate.mjs", ["validate", "ddd", "specs/DomainModel.md"]).code, 0);
    write(project, "specs/Bad.md", "# Model\n");
    const bad = run(project, "harness/gate.mjs", ["validate", "ddd", "specs/Bad.md"]);
    assert.equal(bad.code, 1);
    assert.match(bad.stderr, /Bounded Context/);
  });
});

describe("the hook", () => {
  const edit = (project, session = "s1") =>
    JSON.stringify({ session_id: session, tool_name: "Edit", tool_input: { file_path: `${project}/src/app.ts` } });

  it("warns once per session and lets the edit through", () => {
    const project = makeProject(["harness"]);
    const first = run(project, "harness/gate.mjs", [], edit(project, `warn-${Date.now()}`));
    assert.equal(first.code, 0);
    const output = JSON.parse(first.stdout);
    assert.equal(output.hookSpecificOutput.hookEventName, "PreToolUse");
    assert.match(output.hookSpecificOutput.additionalContext, /No active harness run/);
    assert.match(output.systemMessage, /src\/app\.ts/);
  });

  it("does not repeat the same warning in the same session", () => {
    const project = makeProject(["harness"]);
    const session = `repeat-${Date.now()}`;
    assert.notEqual(run(project, "harness/gate.mjs", [], edit(project, session)).stdout, "");
    assert.equal(run(project, "harness/gate.mjs", [], edit(project, session)).stdout, "");
  });

  it("blocks when the project chose block", () => {
    const project = makeProject(["harness"]);
    const result = run(project, "harness/gate.mjs", [], edit(project), { HARNESS_GATE: "block" });
    assert.equal(result.code, 2);
    assert.match(result.stderr, /not ready/);
  });

  it("ignores paths that are not guarded", () => {
    const project = makeProject(["harness"]);
    const input = JSON.stringify({ tool_name: "Edit", tool_input: { file_path: `${project}/docs/notes.md` } });
    assert.deepEqual(run(project, "harness/gate.mjs", [], input, { HARNESS_GATE: "block" }), {
      code: 0,
      stdout: "",
      stderr: "",
    });
  });

  it("makes check fail only when blocking", () => {
    const project = makeProject(["harness"]);
    assert.equal(run(project, "harness/gate.mjs", ["check", "src/app.ts"]).code, 0);
    assert.equal(run(project, "harness/gate.mjs", ["check", "src/app.ts"], "", { HARNESS_GATE: "block" }).code, 1);
  });
});

describe("what git shows", () => {
  it("reports guarded files changed while the run is open", async () => {
    const { git } = await import("./helpers.mjs");
    const project = makeProject(["harness"]);
    git(project, "init", "-q", "-b", "work");
    git(project, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "--allow-empty", "-m", "start");
    write(project, "docs/harness/runs/r.md", `# Run: x\n\n**Opened:** ${new Date().toISOString().slice(0, 10)}\n`);
    activeRun(project, { mode: "chore", stages: { "adr-gate": "pending" } });
    write(project, "src/app.ts", "export {};\n");
    const gate = await importFrom(project, "harness/gate.mjs");
    const facts = gate.derivedFacts(gate.loadConfig());
    assert.match(facts.join(), /1 guarded file\(s\) changed and not committed: src\/app\.ts/);
    assert.match(run(project, "harness/gate.mjs", ["status"]).stdout, /code already changed while the run was not ready/);
  });
});

describe("escaped defects", () => {
  it("counts fix runs, escapes, and battery cases per month", async () => {
    const project = makeProject(["harness"]);
    const fix = (name, opened, escaped) =>
      write(
        project,
        `docs/harness/runs/${name}.md`,
        `# Run: ${name}\n\n**Mode:** Fix — wrong\n${escaped ? `**Escaped:** yes — introduced by v1.2; battery case: ${escaped}\n` : ""}**Opened:** ${opened}   **Closed:**\n`,
      );
    fix("a", "2026-10-02", "EC-15");
    fix("b", "2026-10-20", "pending");
    fix("c", "2026-11-03", null);
    write(project, "docs/harness/runs/d.md", "**Mode:** Feature — new\n**Opened:** 2026-11-04\n");
    const gate = await importFrom(project, "harness/gate.mjs");
    assert.deepEqual(gate.escapeReport(), [
      { month: "2026-10", fixes: 2, escaped: 2, withCase: 1 },
      { month: "2026-11", fixes: 1, escaped: 0, withCase: 0 },
    ]);
    assert.match(run(project, "harness/gate.mjs", ["escapes"]).stdout, /\| 2026-10 \| 2 \| 2 \| 1 \|/);
  });
});

describe("tasks, qa, and story limits", () => {
  const goodTasks = `# Tasks

### TASK-01 Add the column
**Files:** \`db/migrations/001.sql\`
**Change:** add refund_window_days
**Verify:** \`npm test -- orders\`

### TASK-02 Use it
**Files:** \`src/orders/order.ts\`
**Change:** canRefund reads it
**Verify:** \`npm test -- order.test.ts\`
`;

  it("accepts tasks that each name files, change, and a command", async () => {
    const project = makeProject(["harness"]);
    const gate = await importFrom(project, "harness/gate.mjs");
    write(project, "docs/harness/tasks/t.md", goodTasks);
    assert.deepEqual(gate.recordProblems(gate.loadConfig(), "tasks", "docs/harness/tasks/t.md"), []);
  });

  it("names the task missing a field or a command to verify it", async () => {
    const project = makeProject(["harness"]);
    const gate = await importFrom(project, "harness/gate.mjs");
    write(
      project,
      "t.md",
      goodTasks.replace("**Verify:** `npm test -- orders`", "**Verify:** run the tests").replace("**Files:** `src/orders/order.ts`\n", ""),
    );
    assert.deepEqual(gate.recordProblems(gate.loadConfig(), "tasks", "t.md"), [
      "TASK-01 Add the column: Verify needs a command in backticks",
      "TASK-02 Use it has no Files",
    ]);
    write(project, "empty.md", "# Tasks\n");
    assert.match(gate.recordProblems(gate.loadConfig(), "tasks", "empty.md").join(), /no block matching/);
  });

  it("adds tasks to a run with a trigger", async () => {
    const gate = await importFrom(makeProject(["harness"]), "harness/gate.mjs");
    assert.ok(gate.requiredStages(gate.loadConfig(), "feature", ["schema"]).includes("tasks"));
    assert.ok(!gate.requiredStages(gate.loadConfig(), "feature", []).includes("tasks"));
  });

  it("refuses a spec with more than three user stories", async () => {
    const project = makeProject(["harness"]);
    const gate = await importFrom(project, "harness/gate.mjs");
    const stories = [1, 2, 3, 4].map((n) => `### User Story ${n} — x (Priority: P${n})`).join("\n");
    write(project, "spec.md", `## Problem Statement\n## Functional Requirements\n## Edge Cases\n## Success Criteria\n${stories}\n`);
    assert.match(gate.recordProblems(gate.loadConfig(), "spec", "spec.md").join(), /4 lines matching .* over 3: split it/);
  });

  it("accepts only a qa report that passed", async () => {
    const project = makeProject(["harness"]);
    const gate = await importFrom(project, "harness/gate.mjs");
    const report = (verdict, row) =>
      `# QA\n\n**Verdict:** ${verdict}\n\n## Scenarios\n\n| ID | Scenario | Source | How | Result | Evidence |\n|---|---|---|---|---|---|\n${row}\n`;
    write(project, "pass.md", report("PASS", "| QA-01 | x | US-1 | test | PASS | ok |"));
    write(project, "fail.md", report("FAIL", "| QA-01 | x | US-1 | test | FAIL | 500 |"));
    assert.equal(gate.stageProblem("qa", "done", "pass.md", gate.loadConfig()), null);
    assert.match(gate.stageProblem("qa", "done", "fail.md", gate.loadConfig()), /Verdict:\*\* PASS.*FAIL/);
  });
});
