import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { cleanUp, importFrom, makeProject, write } from "./helpers.mjs";

after(cleanUp);

const load = () => importFrom(makeProject(["tools"]), "tools/cycle-metrics.mjs");

describe("cycle metrics", () => {
  it("compares a window with the one before, of the same length", async () => {
    const metrics = await load();
    assert.deepEqual(metrics.windows("2026-11-03", "2026-11-16"), {
      current: { since: "2026-11-03", until: "2026-11-16", days: 14 },
      previous: { since: "2026-10-20", until: "2026-11-02", days: 14 },
    });
    assert.throws(() => metrics.windows("2026-11-16", "2026-11-03"));
  });

  it("counts merge time, the first look by someone else, size, and pull requests nobody looked at", async () => {
    const metrics = await load();
    const prs = [
      {
        author: { login: "ana" }, createdAt: "2026-11-03T10:00:00Z", mergedAt: "2026-11-04T10:00:00Z", additions: 100, deletions: 20,
        reviews: [{ author: { login: "bia" }, submittedAt: "2026-11-03T12:00:00Z" }],
        comments: [{ author: { login: "ana" }, createdAt: "2026-11-03T10:30:00Z" }, { author: { login: "github-actions" }, createdAt: "2026-11-03T10:05:00Z" }],
      },
      {
        author: { login: "bia" }, createdAt: "2026-11-05T09:00:00Z", mergedAt: "2026-11-05T11:00:00Z", additions: 500, deletions: 10,
        reviews: [], comments: [{ author: { login: "dependabot[bot]" }, createdAt: "2026-11-05T09:10:00Z" }],
      },
    ];
    assert.equal(metrics.firstLookAt(prs[0]), "2026-11-03T12:00:00Z");
    assert.equal(metrics.firstLookAt({ author: { login: "ana" }, reviews: [{ author: { login: "copilot-reviewer", is_bot: true }, submittedAt: "2026-11-03T11:00:00Z" }] }), null);
    assert.deepEqual(metrics.prMetrics(prs), {
      merged: 2,
      hoursToMergeMedian: 13,
      hoursToMergeP90: 21.8,
      firstLookHoursMedian: 2,
      noLookShare: 0.5,
      sizeMedian: 315,
      largeShare: 0.5,
    });
    assert.equal(metrics.prMetrics([]).hoursToMergeMedian, null);
  });

  it("counts failed CI runs over finished ones, and escaped defects from run records", async () => {
    const project = makeProject(["tools"]);
    const metrics = await importFrom(project, "tools/cycle-metrics.mjs");
    assert.equal(metrics.ciFailureShare([{ conclusion: "success" }, { conclusion: "failure" }, { conclusion: "cancelled" }, { conclusion: "" }]), 0.33);
    assert.equal(metrics.ciFailureShare([]), null);
    write(project, "docs/harness/runs/a.md", "**Opened:** 2026-11-05\n**Mode:** Fix\n**Escaped:** yes — introduced by #12; battery case: EC-15\n");
    write(project, "docs/harness/runs/b.md", "**Opened:** 2026-10-01\n**Mode:** Fix\n**Escaped:** yes\n");
    write(project, "docs/harness/runs/c.md", "**Opened:** 2026-11-06\n**Mode:** Feature\n");
    assert.equal(metrics.escapedDefects(`${project}/docs/harness/runs`, { since: "2026-11-03", until: "2026-11-16" }), 1);
    assert.equal(metrics.escapedDefects(`${project}/nowhere`, { since: "2026-11-03", until: "2026-11-16" }), null);
  });

  it("writes a table that shows what it could not read", async () => {
    const metrics = await load();
    const table = metrics.markdownTable({
      window: { since: "2026-11-03", until: "2026-11-16" },
      previousWindow: { since: "2026-10-20", until: "2026-11-02" },
      metrics: { merged: 12, noLookShare: 0.25, ciFailureShare: null },
      previousMetrics: { merged: 9, noLookShare: 0.5 },
      missing: ["CI runs 2026-11-03..2026-11-16: gh: not logged in"],
    });
    assert.match(table, /\| Pull requests merged \| 12 \| 9 \|/);
    assert.match(table, /\| Merged with no one else looking \| 25% \| 50% \|/);
    assert.match(table, /\| CI runs that failed \| n\/a \| n\/a \|/);
    assert.match(table, /Not read:\n- CI runs/);
  });
});
