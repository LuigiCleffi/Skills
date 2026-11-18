// Tests the compiled TypeScript in dist/ (npm test builds first).

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { after, describe, it } from "node:test";
import { classify, hashContent, verifyProject, writeLock } from "../dist/lock.js";
import { declareTriggers, openRun, setStage } from "../dist/harnessRuns.js";
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
      "dev",
      "review",
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
