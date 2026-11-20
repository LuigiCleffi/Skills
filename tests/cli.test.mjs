import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { after, describe, it } from "node:test";
import { cleanUp, makeProject, repoDirectory } from "./helpers.mjs";

after(cleanUp);

const cli = path.join(repoDirectory, "dist/cli.js");

// Runs the installer with no terminal attached, as an agent or CI would.
function kit(project, ...args) {
  const result = spawnSync(process.execPath, [cli, ...args], { cwd: project, input: "", encoding: "utf8" });
  return { code: result.status, out: result.stdout + result.stderr };
}

const read = (project, file) => readFileSync(path.join(project, file), "utf8");

describe("commands", () => {
  it("prints help, the version, and the groups without installing", () => {
    const project = makeProject();
    const version = JSON.parse(read(repoDirectory, "package.json")).version;
    assert.match(kit(project, "--help").out, /Usage: npx skills-code-kit/);
    assert.equal(kit(project, "--version").out.trim(), version);
    assert.match(kit(project, "list").out, /^harness\s+.*also installs .*\bqa\b/m);
    assert.equal(existsSync(path.join(project, "AGENTS.md")), false);
  });

  it("stops with exit 2 on an unknown command, group, or value", () => {
    const project = makeProject();
    assert.equal(kit(project, "instal").code, 2);
    assert.match(kit(project, "--groups", "nope").out, /Unknown group: nope/);
    assert.match(kit(project, "--groups", "dev", "--harness", "loud").out, /--harness takes/);
    assert.match(kit(project, "--groups", "dev", "--frobnicate").out, /Unknown option/);
  });

  it("stops instead of hanging when it must ask and there is no terminal", () => {
    const project = makeProject();
    const { code, out } = kit(project);
    assert.equal(code, 2);
    assert.match(out, /no terminal to ask in/);
    assert.match(kit(project, "--yes").out, /name the groups/);
    assert.match(kit(project, "--groups", "pull-request").out, /needs an answer \(--playwright or --no-playwright\)/);
  });
});

describe("install --yes", () => {
  it("installs the groups and what they require, with the default hooks", () => {
    const project = makeProject();
    const { code } = kit(project, "install", "--groups", "harness,guards", "--yes");
    assert.equal(code, 0);
    assert.ok(existsSync(path.join(project, "actions/qa.md")), "harness requires qa");
    assert.match(read(project, "AGENTS.md"), /harness/i);
    assert.equal(JSON.parse(read(project, "harness/config.json")).enforce, "warn");
    const hooks = JSON.parse(read(project, ".claude/settings.json")).hooks.PreToolUse.map((entry) => entry.hooks[0].command);
    assert.deepEqual(hooks, ['node "$CLAUDE_PROJECT_DIR"/harness/gate.mjs', 'node "$CLAUDE_PROJECT_DIR"/guards/guard.mjs']);
  });

  it("takes each answer from its flag", () => {
    const project = makeProject();
    const { code } = kit(
      project, "install", "--groups", "harness,guards,scrum", "--harness", "block", "--no-guards",
      "--agents", "codex", "--mcp", "none", "--no-playwright",
    );
    assert.equal(code, 0);
    assert.equal(JSON.parse(read(project, "harness/config.json")).enforce, "block");
    assert.equal(read(project, ".claude/settings.json").includes("guard.mjs"), false);
    assert.ok(existsSync(path.join(project, ".codex/agents")), "codex agents");
    assert.equal(existsSync(path.join(project, ".claude/agents")), false);
  });

  it("gives agents to the AI tools it finds, and keeps edited files unless told to overwrite", () => {
    const project = makeProject();
    mkdirSync(path.join(project, ".claude"));
    kit(project, "install", "--groups", "scrum", "--yes");
    assert.ok(existsSync(path.join(project, ".claude/agents/scrum-dev.md")));
    assert.equal(read(project, "CLAUDE.md"), "@AGENTS.md\n");

    appendFileSync(path.join(project, "scrum/handoff.md"), "\nlocal note\n");
    assert.match(kit(project, "install", "--groups", "scrum", "--yes").out, /Skipped to protect your changes:\n\s+- scrum\/handoff.md/);
    assert.match(read(project, "scrum/handoff.md"), /local note/);
    assert.equal(kit(project, "verify").code, 1);

    kit(project, "install", "--groups", "scrum", "--yes", "--overwrite");
    assert.doesNotMatch(read(project, "scrum/handoff.md"), /local note/);
    assert.equal(kit(project, "verify").code, 0);
  });
});

describe("rerunning with fewer groups", () => {
  const lockOf = (project) => JSON.parse(read(project, ".skills-code-kit/lock.json"));

  it("keeps the groups installed earlier in AGENTS.md and the lock", () => {
    const project = makeProject();
    kit(project, "install", "--groups", "guards,bdd", "--yes");
    assert.deepEqual(lockOf(project).groups, ["bdd", "guards"]);

    const { code, out } = kit(project, "install", "--groups", "dev", "--yes");
    assert.equal(code, 0);
    assert.match(out, /keeps the groups installed earlier: bdd, guards/);
    const agents = read(project, "AGENTS.md");
    for (const file of ["actions/dev.md", "actions/bdd.md", "guards/"]) assert.ok(agents.includes(file), file);
    assert.deepEqual(lockOf(project).groups, ["bdd", "dev", "guards"]);
    assert.equal(kit(project, "verify").code, 0);
  });

  it("works out the groups from a lock written before they were recorded", () => {
    const project = makeProject();
    kit(project, "install", "--groups", "bdd", "--yes");
    const lock = lockOf(project);
    delete lock.groups;
    writeFileSync(path.join(project, ".skills-code-kit/lock.json"), JSON.stringify(lock));

    assert.match(kit(project, "install", "--groups", "dev", "--yes").out, /keeps the groups installed earlier: bdd/);
    assert.ok(read(project, "AGENTS.md").includes("actions/bdd.md"));
    assert.deepEqual(lockOf(project).groups, ["bdd", "dev"]);
  });
});

describe("hooks for checks and worktrees", () => {
  it("adds the checks PreToolUse hook and the worktree SessionStart hook once", () => {
    const project = makeProject();
    kit(project, "install", "--groups", "checks,worktrees", "--yes");
    kit(project, "install", "--groups", "checks,worktrees", "--yes");
    const hooks = JSON.parse(read(project, ".claude/settings.json")).hooks;
    assert.deepEqual(hooks.PreToolUse, [
      { matcher: "Bash|mcp__.*create_pull_request", hooks: [{ type: "command", command: 'node "$CLAUDE_PROJECT_DIR"/checks/checks.mjs hook' }] },
    ]);
    assert.equal(hooks.SessionStart.length, 1);
    assert.equal(hooks.SessionStart[0].matcher, undefined);
    assert.match(hooks.SessionStart[0].hooks[0].command, /worktree-slot\.mjs .*\|\| true$/);
    assert.match(read(project, "AGENTS.md"), /node checks\/checks.mjs/);
  });

  it("leaves them out when told to", () => {
    const project = makeProject();
    kit(project, "install", "--groups", "checks,worktrees", "--yes", "--no-checks", "--no-worktree-hook");
    assert.equal(existsSync(path.join(project, ".claude/settings.json")), false);
  });
});

describe("explore and finish", () => {
  it("installs both workflows and lists them in AGENTS.md", () => {
    const project = makeProject();
    assert.equal(kit(project, "install", "--groups", "explore,finish", "--yes").code, 0);
    const agents = read(project, "AGENTS.md");
    assert.ok(agents.includes("actions/explore.md"));
    assert.ok(agents.includes("actions/finish.md"));
  });
});
