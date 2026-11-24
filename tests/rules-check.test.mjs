import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { cleanUp, importFrom, makeProject, run, write } from "./helpers.mjs";

after(cleanUp);

const table = (rows) => `| ID | Rule | Applies to | Enforced by | Checkable | Why |\n|---|---|---|---|---|---|\n${rows.join("\n")}\n`;

describe("rules check", () => {
  it("reads rule rows, line pointers, and cited paths", async () => {
    const check = await importFrom(makeProject(["tools"]), "tools/rules-check.mjs");
    const text = `# AGENTS.md\n\n${table(["| ROOT-01 | Never log tokens. | | review | no | leaks |"])}\nSee AGENTS.md:47 and \`src/api/client.ts\`, \`**/*.ts\`, \`<slug>/x\`.\n\`\`\`\n| ID | Rule |\n|---|---|\n| X-01 | example |\n\`\`\`\n`;
    assert.deepEqual(check.ruleRows(text).map((row) => [row.id, row.enforcedBy, row.why]), [["ROOT-01", "review", "leaks"]]);
    assert.deepEqual(check.lineReferences(text), [7]);
    assert.deepEqual(check.citedPaths(text), ["src/api/client.ts"]);
  });

  it("fails duplicate and retired IDs, long rules, unknown enforcement, missing why, dead paths, budgets, and CLAUDE.md without the import", () => {
    const project = makeProject(["tools"]);
    write(project, "tools/rules-check.json", JSON.stringify({ maxRuleLength: 40, enforcedBy: ["lint", "review"], retired: ["ROOT-09"], budgets: { root: 400, nested: 5 } }));
    write(project, "src/real.ts", "");
    write(project, "AGENTS.md", `# Root\n${table([
      "| ROOT-01 | Short rule. | | lint | yes | why |",
      "| ROOT-09 | Comes back. | | review | no | why |",
      "| ROOT-02 | A rule that goes on far longer than any rule should. | | vibes | no | |",
    ])}\nRead \`src/real.ts\` and \`src/gone.ts\`.\n`);
    write(project, "api/AGENTS.md", `# API\n${table(["| ROOT-01 | Dup. | | lint | yes | why |"])}\nline\nline\n`);
    write(project, "api/CLAUDE.md", "Read the rules.\n");
    const result = run(project, "tools/rules-check.mjs");
    assert.equal(result.code, 1);
    for (const expected of [
      /AGENTS\.md:\d+ ROOT-09: the ID was retired/,
      /AGENTS\.md:\d+ ROOT-02: the rule has \d+ characters \(at most 40\)/,
      /ROOT-02: "Enforced by" must be one of lint, review/,
      /ROOT-02: no "Why"/,
      /AGENTS\.md: cites `src\/gone\.ts`, which does not exist/,
      /api\/AGENTS\.md:\d+ ROOT-01: the ID is also used in AGENTS\.md/,
      /api\/AGENTS\.md: \d+ lines, over the budget of 5/,
      /api\/CLAUDE\.md: does not import AGENTS\.md/,
    ]) assert.match(result.stderr, expected);
    assert.doesNotMatch(result.stderr, /src\/real\.ts/);
  });

  it("passes a project whose rules hold together", () => {
    const project = makeProject(["tools"]);
    write(project, "AGENTS.md", `# Root\n${table(["| ROOT-01 | Never log tokens. | | review | no | leaks |"])}`);
    write(project, "CLAUDE.md", "@AGENTS.md\n");
    assert.equal(run(project, "tools/rules-check.mjs").code, 0);
  });
});

describe("when it cannot run", () => {
  it("exits 2 with the reason, never 1", () => {
    const project = makeProject(["tools"]);
    write(project, "tools/rules-check.json", "{ broken");
    const result = run(project, "tools/rules-check.mjs");
    assert.equal(result.code, 2);
    assert.match(result.stderr, /^rules-check: /);
  });
});
