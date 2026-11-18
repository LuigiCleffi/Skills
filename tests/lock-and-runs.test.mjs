// Tests the compiled TypeScript in dist/ (npm test builds first).

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { after, describe, it } from "node:test";
import { classify, hashContent, verifyProject, writeLock } from "../dist/lock.js";
import { closeRun, declareTriggers, openRun, setStage } from "../dist/harnessRuns.js";
import { cleanUp, makeProject, write } from "./helpers.mjs";

after(cleanUp);

describe("install lock", () => {
  it("classifies a file by what is there, what was installed, and what would be", () => {
    assert.equal(classify(null, undefined, "n"), "new");
    assert.equal(classify("n", "o", "n"), "same");
    assert.equal(classify("o", "o", "n"), "untouched");
    assert.equal(classify("x", "o", "n"), "modified");
    assert.equal(classify("x", undefined, "n"), "modified");
  });

  it("reports changed, deleted, and outdated files", async () => {
    const project = makeProject();
    const templates = makeProject();
    write(project, "a.md", "edited");
    write(project, "b.md", "same");
    write(templates, "b.md", "newer template");
    await writeLock(project, {
      version: "1.0.0",
      files: { "a.md": hashContent("original"), "b.md": hashContent("same"), "c.md": hashContent("gone") },
    });
    assert.deepEqual(await verifyProject(project, templates), {
      checked: 3,
      missing: ["c.md"],
      modified: ["a.md"],
      outdated: ["b.md"],
    });
  });

  it("returns null without a lock", async () => {
    assert.equal(await verifyProject(makeProject(), makeProject()), null);
  });
});

describe("harness runs", () => {
  const read = (project, file) => readFileSync(path.join(project, file), "utf8");

  it("opens a light run without triggers and a deeper one with them", async () => {
    const light = makeProject(["harness"]);
    await openRun(light, { request: "Change a label", mode: "feature", reason: "visible copy", slug: "label" });
    assert.ok(!("ddd" in JSON.parse(read(light, "docs/harness/active.json")).stages));

    const deep = makeProject(["harness"]);
    const message = await openRun(deep, {
      request: "Refund window",
      mode: "feature",
      reason: "new behavior",
      slug: "refunds",
      triggers: ["schema"],
    });
    const state = JSON.parse(read(deep, "docs/harness/active.json"));
    assert.deepEqual(state.triggers, ["schema"]);
    assert.ok("ddd" in state.stages);
    assert.match(message, /triggers: schema/);
  });

  it("refuses an unknown trigger", async () => {
    await assert.rejects(
      openRun(makeProject(["harness"]), { request: "x", mode: "fix", reason: "y", slug: "z", triggers: ["typo"] }),
      /Unknown trigger/,
    );
  });

  it("adds the triggered stages when a trigger is declared later", async () => {
    const project = makeProject(["harness"]);
    await openRun(project, { request: "Fix totals", mode: "fix", reason: "wrong sum", slug: "totals" });
    await declareTriggers(project, { triggers: ["concurrency"], evidence: "two jobs update the same order" });

    const state = JSON.parse(read(project, "docs/harness/active.json"));
    assert.deepEqual(Object.keys(state.stages), [
      "spec",
      "reproduce",
      "ddd",
      "knowledge-gate",
      "adr-gate",
      "tasks",
      "dev",
      "review",
      "qa",
      "code-review",
    ]);
    const record = read(project, state.run);
    assert.match(record, /\*\*Triggers:\*\* concurrency/);
    assert.match(record, /\| ddd \| pending/);
    assert.match(record, /two jobs update the same order/);
  });

  it("refuses done when the record fails its checks", async () => {
    const project = makeProject(["harness"]);
    await openRun(project, { request: "x", mode: "fix", reason: "y", slug: "z", triggers: ["schema"] });
    write(project, "specs/DomainModel.md", "# Domain Model\n");
    await assert.rejects(
      setStage(project, { stage: "ddd", status: "done", record: "specs/DomainModel.md" }),
      /Bounded Context/,
    );
  });
});

describe("escaped defect runs", () => {
  const read = (project, file) => readFileSync(path.join(project, file), "utf8");
  const settleAll = async (project) => {
    const state = JSON.parse(read(project, "docs/harness/active.json"));
    for (const stage of Object.keys(state.stages)) {
      await setStage(project, { stage, status: "skipped", reason: "not needed in this test" });
    }
  };

  it("records the escape and closes only with the battery case", async () => {
    const project = makeProject(["harness"]);
    await openRun(project, { request: "Fix double charge", mode: "fix", reason: "charged twice", slug: "charge", escapedFrom: "PR #12" });
    const runFile = JSON.parse(read(project, "docs/harness/active.json")).run;
    assert.match(read(project, runFile), /\*\*Escaped:\*\* yes — introduced by PR #12; battery case: pending/);

    await settleAll(project);
    await assert.rejects(closeRun(project, { status: "Closed", result: "fixed" }), /edge-cases\.md/);
    await closeRun(project, { status: "Closed", result: "fixed", batteryCase: "EC-15" });
    assert.match(read(project, runFile), /battery case: EC-15/);
  });

  it("refuses an escape on a run that is not a fix", async () => {
    await assert.rejects(
      openRun(makeProject(["harness"]), { request: "x", mode: "feature", reason: "y", slug: "z", escapedFrom: "PR #1" }),
      /Only a fix run/,
    );
  });
});

describe("post-code stages", () => {
  const read = (project, file) => readFileSync(path.join(project, file), "utf8");
  it("puts qa between review and code-review, and leaves it out of a chore", async () => {
    const feature = makeProject(["harness"]);
    await openRun(feature, { request: "x", mode: "feature", reason: "y", slug: "f" });
    assert.deepEqual(Object.keys(JSON.parse(read(feature, "docs/harness/active.json")).stages).slice(-4), [
      "dev",
      "review",
      "qa",
      "code-review",
    ]);
    const chore = makeProject(["harness"]);
    await openRun(chore, { request: "x", mode: "chore", reason: "y", slug: "c" });
    assert.deepEqual(Object.keys(JSON.parse(read(chore, "docs/harness/active.json")).stages), ["adr-gate", "dev", "review"]);
  });
});
