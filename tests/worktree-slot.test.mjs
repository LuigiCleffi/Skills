import assert from "node:assert/strict";
import { lstatSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { after, describe, it } from "node:test";
import { cleanUp, git, importFrom, makeProject, run, write } from "./helpers.mjs";

after(cleanUp);

describe("worktree slots", () => {
  it("keeps slots stable and reuses the lowest free one", async () => {
    const slots = await importFrom(makeProject(["tools"]), "tools/worktree-slot.mjs");
    assert.deepEqual(slots.assignSlots(["/main", "/a", "/b"]), { "/main": 0, "/a": 1, "/b": 2 });
    assert.deepEqual(slots.assignSlots(["/main", "/b", "/c"], { "/main": 0, "/a": 1, "/b": 2 }), {
      "/main": 0,
      "/b": 2,
      "/c": 1,
    });
  });

  it("derives ports and names from the slot", async () => {
    const slots = await importFrom(makeProject(["tools"]), "tools/worktree-slot.mjs");
    const config = { portStep: 10, ports: { PORT: 3000, WEB_PORT: 5173 }, variables: { DATABASE_NAME: "shop{suffix}", QUEUE: "q-{slot}" } };
    assert.deepEqual(slots.variablesFor(config, 0), { WORKTREE_SLOT: "0", PORT: "3000", WEB_PORT: "5173", DATABASE_NAME: "shop", QUEUE: "q-0" });
    assert.deepEqual(slots.variablesFor(config, 2), { WORKTREE_SLOT: "2", PORT: "3020", WEB_PORT: "5193", DATABASE_NAME: "shop_wt2", QUEUE: "q-2" });
  });

  it("writes the env file for a real worktree", () => {
    const project = makeProject(["tools"]);
    git(project, "init", "-q", "-b", "main");
    git(project, "add", "-A");
    git(project, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", "start");
    const other = `${project}-wt`;
    git(project, "worktree", "add", "-q", other);
    try {
      const result = run(project, "tools/worktree-slot.mjs", [], "", {});
      assert.equal(result.code, 0, result.stderr);
      const fromWorktree = run(other, "tools/worktree-slot.mjs");
      assert.equal(fromWorktree.code, 0, fromWorktree.stderr);
      const env = readFileSync(path.join(other, ".worktree-slot.env"), "utf8");
      assert.match(env, /WORKTREE_SLOT=1/);
      assert.match(env, /PORT=3010/);
      assert.match(env, /DATABASE_NAME=app_wt1/);
      assert.match(readFileSync(path.join(project, ".worktree-slot.env"), "utf8"), /PORT=3000/);
    } finally {
      git(project, "worktree", "remove", "--force", realpathSync(other));
    }
  });
});

describe("worktree provisioning", () => {
  it("keeps ports off the ones browsers and macOS refuse, inside the slot's block", async () => {
    const slots = await importFrom(makeProject(["tools"]), "tools/worktree-slot.mjs");
    assert.equal(slots.portFor(4990, 1, 10), 5001);
    assert.equal(slots.portFor(6990, 1, 10), 7001);
    assert.equal(slots.portFor(3000, 2, 10), 3020);
  });

  it("copies listed untracked files and links dependencies into a new worktree, and prints one line as a hook", () => {
    const project = makeProject(["tools"]);
    write(project, ".gitignore", ".env.local\nnode_modules\n.worktree-slot.env\nconfig/*.local.json\n");
    write(project, ".worktreeinclude", "# untracked files a worktree needs\n.env.local\nconfig/*.local.json\n");
    write(project, ".env.local", "TOKEN=dev\n");
    write(project, "config/db.local.json", "{}");
    write(project, "node_modules/x/index.js", "");
    writeFileSync(path.join(project, "tools/worktree.json"), JSON.stringify({ ports: { PORT: 3000 }, include: ".worktreeinclude", linkDependencies: ["node_modules"] }));
    git(project, "init", "-q", "-b", "main");
    git(project, "add", "-A");
    git(project, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", "start");
    const other = `${project}-wt`;
    git(project, "worktree", "add", "-q", other);
    try {
      const hook = run(other, "tools/worktree-slot.mjs", ["--hook"]);
      assert.equal(hook.code, 0, hook.stderr);
      assert.match(hook.stdout, /^Worktree slot 1: PORT=3010 \(in \.worktree-slot\.env\); copied \.env\.local, config\/db\.local\.json; linked node_modules\.\n$/);
      assert.equal(readFileSync(path.join(other, ".env.local"), "utf8"), "TOKEN=dev\n");
      assert.ok(lstatSync(path.join(other, "node_modules")).isSymbolicLink());

      writeFileSync(path.join(other, ".env.local"), "TOKEN=mine\n");
      run(other, "tools/worktree-slot.mjs", ["--hook"]);
      assert.equal(readFileSync(path.join(other, ".env.local"), "utf8"), "TOKEN=mine\n");
    } finally {
      git(project, "worktree", "remove", "--force", other);
    }
    const outside = makeProject(["tools"]);
    assert.deepEqual(run(outside, "tools/worktree-slot.mjs", ["--hook"]), { code: 0, stdout: "", stderr: "" });
  });
});
