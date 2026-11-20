import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { after, describe, it } from "node:test";
import { cleanUp, importFrom, makeProject, run, templateDirectory, write } from "./helpers.mjs";

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
      `# QA\n\n**Verdict:** ${verdict}\n\n## Change against the tasks\n\nMISSING CHANGE: none.\n\n## Scenarios\n\n| ID | Scenario | Source | How | Result | Evidence |\n|---|---|---|---|---|---|\n${row}\n`;
    write(project, "pass.md", report("PASS", "| QA-01 | x | US-1 | test | PASS | ok |"));
    write(project, "fail.md", report("FAIL", "| QA-01 | x | US-1 | test | FAIL | 500 |"));
    assert.equal(gate.stageProblem("qa", "done", "pass.md", gate.loadConfig()), null);
    assert.match(gate.stageProblem("qa", "done", "fail.md", gate.loadConfig()), /Verdict:\*\* PASS.*FAIL/);
    write(project, "unchecked.md", report("PASS", "| QA-01 | x | US-1 | test | PASS | ok |").replace(/## Change against the tasks\n\nMISSING CHANGE: none.\n\n/, ""));
    assert.match(gate.stageProblem("qa", "done", "unchecked.md", gate.loadConfig()), /Change against the tasks/);
  });
});

describe("fenced examples in records", () => {
  it("does not let a fenced example settle or fail a record", async () => {
    const project = makeProject(["harness"]);
    const gate = await importFrom(project, "harness/gate.mjs");
    const config = gate.loadConfig();
    const pass = "| QA-01 | x | US-1 | test | PASS | 12 passed |";
    const report = (extra) => `# QA\n\n**Verdict:** PASS\n\n## Change against the tasks\n\nnone\n\n## Scenarios\n\n${pass}\n${extra}`;
    write(project, "qa.md", report("\n```markdown\n| QA-09 | example | x | y | FAIL | z |\n```\n"));
    assert.equal(gate.stageProblem("qa", "done", "qa.md", config), null);
    write(project, "only-example.md", "# QA\n\n````md\n**Verdict:** PASS\n## Scenarios\n```\nstill inside\n````\n");
    assert.match(gate.stageProblem("qa", "done", "only-example.md", config), /Verdict:\*\* PASS/);
    assert.equal(gate.withoutFences("a\n~~~\nb\n~~~\nc"), "a\nc");
  });
});

describe("tasks, coverage, and the board", () => {
  const tasksText = [
    "### TASK-01 Window",
    "**Files:** `db/m.sql` (new), `src/order.ts`",
    "**Depends:** none",
    "**Status:** done",
    "### TASK-02 API",
    "**Files:** `src/api.ts`",
    "**Depends:** TASK-01",
    "### TASK-03 UI",
    "**Files:** `src/ui.ts` (new)",
    "**Depends:** TASK-02, TASK-09",
    "**Status:** doing",
  ].join("\n");

  it("reads tasks, finds missing files, unknown dependencies, and circles", async () => {
    const gate = await importFrom(makeProject(["harness"]), "harness/gate.mjs");
    const tasks = gate.parseTasks(tasksText);
    assert.deepEqual(tasks.map((task) => [task.id, task.status, task.depends]), [
      ["TASK-01", "done", []],
      ["TASK-02", "todo", ["TASK-01"]],
      ["TASK-03", "doing", ["TASK-02", "TASK-09"]],
    ]);
    const exists = (file) => file === "src/order.ts";
    assert.deepEqual(gate.taskProblems(tasks, exists), [
      'TASK-02 names src/api.ts, which does not exist; mark it "(new)" if the task creates it',
      "TASK-03 depends on TASK-09, which is not a task",
    ]);
    const circle = gate.parseTasks("### TASK-1 a\n**Depends:** TASK-2\n### TASK-2 b\n**Depends:** TASK-1\n");
    assert.deepEqual(gate.dependencyCycle(circle), ["TASK-1", "TASK-2", "TASK-1"]);
    assert.deepEqual(gate.boardOf(tasks).frontier.map((task) => task.id), ["TASK-02"]);
  });

  it("checks that every criterion has a scenario with evidence", async () => {
    const project = makeProject(["harness"]);
    const gate = await importFrom(project, "harness/gate.mjs");
    const spec = "- **FR-001:** refunds within 30 days\n- **FR-002:** refund once\n```\nFR-099 is an example\n```\n";
    const qa = [
      "| ID | Scenario | Source | How | Result | Evidence |",
      "|---|---|---|---|---|---|",
      "| QA-01 | within 30 days | FR-001 | npm test | PASS | 12 passed |",
      "| QA-02 | twice | FR-003 | Playwright | PASS | ok |",
    ].join("\n");
    assert.deepEqual(gate.coverageProblems(gate.loadConfig(), spec, qa), [
      "QA-02 cites FR-003, which the spec does not name",
      'QA-02 passed with no evidence ("ok"): say what was run and what it showed',
      "FR-002 has no scenario in the QA report",
    ]);
    write(project, "spec.md", spec);
    write(project, "qa.md", qa);
    assert.equal(run(project, "harness/gate.mjs", ["coverage", "spec.md", "qa.md"]).code, 1);
  });

  it("briefs the agent on the run once per session, and stays silent without a run", () => {
    const project = makeProject(["harness"]);
    const prompt = JSON.stringify({ session_id: `s-${Date.now()}-${Math.random()}`, prompt: "go" });
    assert.equal(run(project, "harness/gate.mjs", ["brief"], prompt).stdout, "");
    write(project, "docs/harness/tasks.md", tasksText);
    write(project, "docs/harness/active.json", JSON.stringify({ run: "docs/harness/runs/x.md", mode: "fix", stages: { reproduce: "done" }, records: { tasks: "docs/harness/tasks.md" } }));
    const first = run(project, "harness/gate.mjs", ["brief"], prompt);
    const context = JSON.parse(first.stdout).hookSpecificOutput.additionalContext;
    assert.match(context, /mode fix/);
    assert.match(context, /Next stage: knowledge-gate, following actions\/knowledge\.md/);
    assert.match(context, /Tasks: 1\/3 done; can start: TASK-02/);
    assert.equal(run(project, "harness/gate.mjs", ["brief"], prompt).stdout, "");
  });

  it("reminds what governs a path before it is edited", () => {
    const project = makeProject(["harness"]);
    write(project, "docs/knowledge/README.md", "| About… | Keywords | Paths | Read |\n|---|---|---|---|\n| Refunds | refund | `src/billing/**` | [BR-0003](rules/BR-0003.md) |\n");
    write(project, "harness/config.json", JSON.stringify({ ...JSON.parse(readFileSync(path.join(project, "harness/config.json"), "utf8")), enforce: "warn" }));
    const edit = (file) => JSON.stringify({ session_id: `s-${Math.random()}`, tool_name: "Edit", tool_input: { file_path: path.join(project, file) } });
    const reminded = run(project, "harness/gate.mjs", [], edit("docs/billing-notes.md"));
    assert.equal(reminded.stdout, "");
    const billing = JSON.parse(run(project, "harness/gate.mjs", [], edit("src/billing/refund.ts")).stdout);
    assert.match(billing.hookSpecificOutput.additionalContext, /src\/billing\/refund\.ts is governed by docs\/knowledge\/README\.md: read BR-0003/);
  });

  it("warns about an issue that does not follow the format, and only for issue tools", () => {
    const project = makeProject(["harness"]);
    const save = (tool, description) => JSON.stringify({ tool_name: tool, tool_input: { title: "x", description } });
    const warned = run(project, "harness/gate.mjs", ["issue"], save("mcp__tracker__save_issue", "Just do it"));
    assert.equal(warned.code, 0);
    assert.match(JSON.parse(warned.stdout).hookSpecificOutput.additionalContext, /no "Problem" heading/);
    assert.equal(run(project, "harness/gate.mjs", ["issue"], save("mcp__tracker__save_issue", "## Problem\nx\n## Acceptance criteria\n- y")).stdout, "");
    assert.equal(run(project, "harness/gate.mjs", ["issue"], save("mcp__tracker__get_issue", "Just do it")).stdout, "");
  });
});

describe("design rules territory", () => {
  it("reminds which rule groups govern a screen file", async () => {
    const project = makeProject(["harness"]);
    write(project, "docs/design/RULES.md", readFileSync(path.join(templateDirectory, "docs/design/RULES.md"), "utf8"));
    const gate = await importFrom(project, "harness/gate.mjs");
    assert.deepEqual(gate.territoryFor("src/orders/List.tsx"), [
      "src/orders/List.tsx is governed by docs/design/RULES.md: read L, K, V, DONT before writing here.",
    ]);
    assert.deepEqual(gate.territoryFor("server/api.go"), []);
  });
});
