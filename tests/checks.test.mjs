import assert from "node:assert/strict";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { after, describe, it } from "node:test";
import { cleanUp, git, importFrom, makeProject, run, write } from "./helpers.mjs";

after(cleanUp);

// A project on main with one commit, then a feature branch, so the checks
// have a base to measure the diff against.
function repo(checks) {
  const project = makeProject(["checks"]);
  const configFile = path.join(project, "checks/config.json");
  const config = { ...JSON.parse(readFileSync(configFile, "utf8")), base: "main", checks };
  writeFileSync(configFile, JSON.stringify(config));
  git(project, "init", "-q", "-b", "main");
  git(project, "config", "user.email", "test@example.com");
  git(project, "config", "user.name", "Test");
  git(project, "add", "-A");
  git(project, "commit", "-qm", "base");
  git(project, "checkout", "-qb", "feature");
  return project;
}

function commit(project, file, content = "x\n") {
  write(project, file, content);
  git(project, "add", "-A");
  git(project, "commit", "-qm", `change ${file}`);
}

const prCreate = (project) => JSON.stringify({ tool_name: "Bash", tool_input: { command: "gh pr create --fill" }, cwd: project });

describe("plannedChecks", () => {
  it("runs a check when a changed file reaches it, and nothing for ignored files", async () => {
    const { plannedChecks } = await importFrom(makeProject(["checks"]), "checks/checks.mjs");
    const config = {
      ignore: ["**/*.md"],
      checks: [{ name: "all", command: "a" }, { name: "ts", command: "b", when: ["**/*.ts"] }],
    };
    assert.deepEqual(plannedChecks(config, ["src/a.js"]).map((check) => check.name), ["all"]);
    assert.deepEqual(plannedChecks(config, ["src/a.ts"]).map((check) => check.name), ["all", "ts"]);
    assert.deepEqual(plannedChecks(config, ["README.md"]), []);
    const diagrams = { ignore: ["**/*.md"], checks: [{ name: "all", command: "a" }, { name: "diagrams", command: "d", when: ["**/*.md"] }] };
    assert.deepEqual(plannedChecks(diagrams, ["docs/flow.md"]).map((check) => check.name), ["diagrams"]);
  });
});

describe("opensPullRequest", () => {
  it("knows the ways an agent opens a pull request, and nothing else", async () => {
    const { opensPullRequest } = await importFrom(makeProject(["checks"]), "checks/checks.mjs");
    const bash = (command) => ["Bash", { command }];
    assert.ok(opensPullRequest(...bash("gh pr create --fill")));
    assert.ok(opensPullRequest(...bash("gh api repos/acme/app/pulls -f title=x -f head=b -f base=main")));
    assert.ok(opensPullRequest("mcp__github__create_pull_request", {}));
    assert.equal(opensPullRequest(...bash("gh pr view 3")), false);
    assert.equal(opensPullRequest(...bash("gh api repos/acme/app/pulls")), false);
    assert.equal(opensPullRequest("Edit", { file_path: "x" }), false);
  });
});

describe("the checks run", () => {
  it("stamps the commit when the checks pass, and the hook then lets the pull request open", () => {
    const project = repo([{ name: "ok", command: "node -e \"process.exit(0)\"" }]);
    commit(project, "src/a.js");
    assert.equal(run(project, "checks/checks.mjs", ["hook"], prCreate(project)).code, 2);

    const checked = run(project, "checks/checks.mjs");
    assert.equal(checked.code, 0, checked.stderr);
    assert.match(checked.stdout, /stamped/);
    assert.equal(run(project, "checks/checks.mjs", ["hook"], prCreate(project)).code, 0);
    assert.match(run(project, "checks/checks.mjs").stdout, /already passed/);
  });

  it("does not stamp a failing commit, nor a commit with uncommitted work", () => {
    const project = repo([{ name: "fails", command: "node -e \"process.exit(3)\"" }]);
    commit(project, "src/a.js");
    assert.equal(run(project, "checks/checks.mjs").code, 1);
    assert.equal(run(project, "checks/checks.mjs", ["status"]).code, 1);

    write(project, "checks/config.json", JSON.stringify({ base: "main", checks: [] }));
    assert.match(run(project, "checks/checks.mjs").stderr, /commit or stash/);
  });

  it("is refused again after a new commit", () => {
    const project = repo([{ name: "ok", command: "node -e \"0\"" }]);
    commit(project, "src/a.js");
    run(project, "checks/checks.mjs");
    commit(project, "src/b.js");
    assert.match(run(project, "checks/checks.mjs", ["hook"], prCreate(project)).stderr, /have not passed on commit/);
  });

  it("runs again when the base moves under the same commit", () => {
    const project = repo([{ name: "ok", command: "node -e \"0\"" }]);
    commit(project, "src/a.js");
    run(project, "checks/checks.mjs");
    assert.equal(run(project, "checks/checks.mjs", ["hook"], prCreate(project)).code, 0);

    git(project, "checkout", "-q", "main");
    commit(project, "src/other.js");
    git(project, "checkout", "-q", "feature");
    git(project, "rebase", "-q", "main");
    const head = git(project, "rev-parse", "HEAD");
    // The rebase made a new commit; stamp the old one's verdict on it to stand in for a stale stamp.
    const stampDirectory = path.join(project, ".git", "skills-code-kit-checks");
    const [old] = readdirSync(stampDirectory);
    const stale = JSON.parse(readFileSync(path.join(stampDirectory, old), "utf8"));
    writeFileSync(path.join(stampDirectory, `${head}.json`), JSON.stringify({ ...stale, sha: head }));

    assert.match(run(project, "checks/checks.mjs", ["hook"], prCreate(project)).stderr, /the base moved/);
    assert.match(run(project, "checks/checks.mjs", ["status"]).stdout, /base moved/);
    assert.match(run(project, "checks/checks.mjs").stdout, /stamped/);
    assert.equal(run(project, "checks/checks.mjs", ["hook"], prCreate(project)).code, 0);
  });

  it("stamps a waiver only with its reason", () => {
    const project = repo([{ name: "fails", command: "node -e \"process.exit(1)\"" }]);
    commit(project, "src/a.js");
    assert.equal(run(project, "checks/checks.mjs", ["--waive", "no"]).code, 1);
    assert.equal(run(project, "checks/checks.mjs", ["--waive", "docs-only change to the release notes"]).code, 0);
    assert.match(run(project, "checks/checks.mjs", ["status"]).stdout, /waived — docs-only/);
    assert.equal(run(project, "checks/checks.mjs", ["hook"], prCreate(project)).code, 0);
  });

  it("lets everything else through, and fails open on input it cannot read", () => {
    const project = repo([]);
    const other = JSON.stringify({ tool_name: "Bash", tool_input: { command: "git push" }, cwd: project });
    assert.equal(run(project, "checks/checks.mjs", ["hook"], other).code, 0);
    assert.equal(run(project, "checks/checks.mjs", ["hook"], "not json").code, 0);
  });
});

describe("harness scope", () => {
  it("names the touched modules no record of the run claims", async () => {
    const project = makeProject(["harness"]);
    const { declaredPaths, undeclaredModules } = await importFrom(project, "harness/gate.mjs");
    const declared = declaredPaths("### TASK-1\n- **Files:** `src/billing/refund.ts`, `./src/billing/api.ts`\nRun `npm test`.");
    assert.deepEqual(declared, ["src/billing/refund.ts", "src/billing/api.ts"]);
    assert.deepEqual(
      undeclaredModules(["src/billing/refund.ts", "src/billing/new.ts", "src/essay/fix.ts", "src/essay/b.ts"], declared),
      [{ module: "src/essay", files: ["src/essay/fix.ts", "src/essay/b.ts"] }],
    );
  });

  it("reports from the active run and the branch, and exits 0", () => {
    const project = makeProject(["harness"]);
    git(project, "init", "-q", "-b", "main");
    git(project, "config", "user.email", "test@example.com");
    git(project, "config", "user.name", "Test");
    git(project, "add", "-A");
    git(project, "commit", "-qm", "base");
    git(project, "checkout", "-qb", "feature");
    write(project, "docs/harness/tasks.md", "### TASK-1\n- **Files:** `src/billing/refund.ts`\n");
    write(project, "docs/harness/active.json", JSON.stringify({ mode: "fix", records: { tasks: "docs/harness/tasks.md" } }));
    write(project, "src/billing/refund.ts", "x");
    write(project, "src/essay/fix.ts", "x");

    const { code, stdout } = run(project, "harness/gate.mjs", ["scope", "--base", "main"]);
    assert.equal(code, 0);
    assert.match(stdout, /src\/essay \(1 file: src\/essay\/fix.ts\)/);
    assert.doesNotMatch(stdout, /src\/billing \(/);
    assert.match(stdout, /MISSING CHANGE: none/);

    write(project, "docs/harness/tasks.md", "### TASK-1\n- **Files:** `src/billing/refund.ts`, `src/billing/api.ts`\n");
    assert.match(run(project, "harness/gate.mjs", ["scope", "--base", "main"]).stdout, /MISSING CHANGE: named in the run's records but not changed[^\n]*\n\s+- src\/billing\/api.ts/);
  });
});

describe("pre-push", () => {
  it("reads the pushed commits from git's lines, ignoring tags and deletes", async () => {
    const { pushedCommits, checkEnvironment } = await importFrom(makeProject(["checks"]), "checks/checks.mjs");
    const zero = "0".repeat(40);
    const a = "a".repeat(40);
    const b = "b".repeat(40);
    assert.deepEqual(
      pushedCommits(`HEAD ${a} refs/heads/feature/x ${zero}\nrefs/tags/v1 ${b} refs/tags/v1 ${zero}\n(delete) ${zero} refs/heads/old ${a}\n`),
      [{ sha: a, branch: "feature/x" }],
    );
    const environment = checkEnvironment({ GIT_DIR: "/repo/.git", GIT_INDEX_FILE: "x", PATH: "/bin" });
    assert.deepEqual(environment, { PATH: "/bin" });
  });

  it("runs the checks for the pushed commit and refuses one it cannot check", () => {
    const project = repo([{ name: "ok", command: "node -e \"0\"" }]);
    commit(project, "src/a.js");
    const head = git(project, "rev-parse", "HEAD");
    const zero = "0".repeat(40);
    const pushed = run(project, "checks/checks.mjs", ["pre-push"], `refs/heads/feature ${head} refs/heads/feature ${zero}\n`);
    assert.equal(pushed.code, 0, pushed.stderr);
    assert.match(run(project, "checks/checks.mjs", ["status"]).stdout, /passed ok/);

    commit(project, "src/b.js");
    const older = git(project, "rev-parse", "HEAD~1");
    commit(project, "src/c.js");
    const refused = run(project, "checks/checks.mjs", ["pre-push"], `HEAD~1 ${git(project, "rev-parse", "HEAD~1")} refs/heads/feature ${older}\n`);
    assert.equal(refused.code, 1);
    assert.match(refused.stderr, /not the checked-out commit/);
  });
});

describe("screenshots in the pull request", () => {
  const config = { screenshots: { when: ["**/*.tsx", "**/*.css"] } };
  const sha = "a".repeat(40);

  it("asks for an image when screens change, and accepts a reason instead", async () => {
    const { screenshotProblem } = await importFrom(makeProject(["checks"]), "checks/checks.mjs");
    assert.equal(screenshotProblem("## Why\nx", ["src/api.ts"], config), null);
    assert.match(screenshotProblem("## How it is\n<!-- ![placeholder](x.png) -->", ["src/List.tsx"], config), /no screenshot/);
    assert.equal(screenshotProblem(`![after](https://github.com/o/r/blob/${sha}/shots/1.png?raw=1)`, ["src/List.tsx"], config), null);
    assert.equal(screenshotProblem("<!-- no-screenshot: only a class rename -->", ["src/a.css"], config), null);
    assert.match(screenshotProblem("![after](https://github.com/o/r/blob/feature/x/shots/1.png?raw=1)", ["src/List.tsx"], config), /links an image by branch/);
    assert.match(screenshotProblem('<img src="https://raw.githubusercontent.com/o/r/main/a.png">', ["src/List.tsx"], config), /by branch/);
    assert.equal(screenshotProblem(null, ["src/List.tsx"], config), null);
  });

  it("reads the body from gh flags, a body file, or the MCP call", async () => {
    const project = makeProject(["checks"]);
    const { pullRequestBody } = await importFrom(project, "checks/checks.mjs");
    write(project, "body.md", "from the file");
    assert.equal(pullRequestBody("Bash", { command: 'gh pr create --title t --body-file body.md' }, project), "from the file");
    assert.match(pullRequestBody("Bash", { command: 'gh pr create --title t --body "![a](x.png)"' }, project), /!\[a\]\(x\.png\)/);
    assert.equal(pullRequestBody("Bash", { command: "gh pr create --fill" }, project), null);
    assert.equal(pullRequestBody("mcp__github__create_pull_request", { body: "mcp body" }, project), "mcp body");
  });

  it("refuses a stamped pull request that touches a screen without a screenshot", () => {
    const project = repo([{ name: "ok", command: "node -e \"0\"" }]);
    commit(project, "src/List.tsx", "export const List = () => null;\n");
    run(project, "checks/checks.mjs");
    const open = (body) => JSON.stringify({ tool_name: "Bash", tool_input: { command: `gh pr create --title t --body "${body}"` }, cwd: project });
    assert.match(run(project, "checks/checks.mjs", ["hook"], open("## Why\\nfaster list")).stderr, /has no screenshot/);
    assert.equal(run(project, "checks/checks.mjs", ["hook"], open("<!-- no-screenshot: props only -->")).code, 0);
  });
});
