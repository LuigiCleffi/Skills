import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { cleanUp, importFrom, makeProject, run, write } from "./helpers.mjs";

after(cleanUp);

const rootRules = `# AGENTS.md

## Project Rules

| ID | Rule | Applies to | Enforced by | Checkable | Why |
|---|---|---|---|---|---|
| ROOT-01 | No \`any\` in TypeScript. | \`**/*.ts\` | lint | yes | Types are the contract. |
| ROOT-02 | Every endpoint checks the tenant. | | review | partial | A tenant leak is a data breach. |
`;

const apiRules = `| ID | Rule | Applies to | Enforced by |
|---|---|---|---|
| API-01 | Money is integer cents. | \`src/billing/**\` | review |
`;

describe("parseRules", () => {
  it("reads rule rows with their scope and globs", async () => {
    const project = makeProject(["tools"]);
    const context = await importFrom(project, "tools/review-context.mjs");
    const rules = context.parseRules(apiRules, "api/AGENTS.md");
    assert.deepEqual(rules, [
      {
        id: "API-01",
        rule: "Money is integer cents.",
        appliesTo: ["src/billing/**"],
        enforcedBy: "review",
        why: "",
        source: "api/AGENTS.md",
        scope: "api",
      },
    ]);
  });

  it("skips tables that are not rule tables and rows without an ID", async () => {
    const context = await importFrom(makeProject(["tools"]), "tools/review-context.mjs");
    assert.deepEqual(context.parseRules("| Name | Port |\n|---|---|\n| api | 3000 |\n", "AGENTS.md"), []);
    assert.deepEqual(context.parseRules("| ID | Rule |\n|---|---|\n| | example |\n", "AGENTS.md"), []);
  });
});

describe("rulesForFiles", () => {
  it("keeps the rules whose folder and globs the files fall under", async () => {
    const context = await importFrom(makeProject(["tools"]), "tools/review-context.mjs");
    const rules = [...context.parseRules(rootRules, "AGENTS.md"), ...context.parseRules(apiRules, "api/AGENTS.md")];
    const matched = context.rulesForFiles(rules, ["api/src/billing/refund.ts", "web/app.css"]);
    assert.deepEqual(
      matched.map((rule) => [rule.id, rule.files, rule.machineEnforced]),
      [
        ["ROOT-01", ["api/src/billing/refund.ts"], true],
        ["ROOT-02", ["api/src/billing/refund.ts", "web/app.css"], false],
        ["API-01", ["api/src/billing/refund.ts"], false],
      ],
    );
  });
});

describe("the command", () => {
  it("separates review-enforced from machine-enforced rules", () => {
    const project = makeProject(["tools"]);
    write(project, "AGENTS.md", rootRules);
    write(project, "api/AGENTS.md", apiRules);
    const result = run(project, "tools/review-context.mjs", ["--files", "api/src/billing/refund.ts"]);
    assert.equal(result.code, 0, result.stderr);
    const [review, machine] = result.stdout.split("## Enforced by a machine");
    assert.match(review, /ROOT-02/);
    assert.match(review, /API-01/);
    assert.doesNotMatch(review, /ROOT-01/);
    assert.match(machine, /ROOT-01/);
  });

  it("says so when no rule applies", () => {
    const project = makeProject(["tools"]);
    write(project, "api/AGENTS.md", apiRules);
    assert.match(run(project, "tools/review-context.mjs", ["--files", "web/app.css"]).stdout, /No project rule/);
  });
});
