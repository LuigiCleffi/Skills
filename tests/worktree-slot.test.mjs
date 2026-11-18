import assert from "node:assert/strict";
import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { after, describe, it } from "node:test";
import { cleanUp, git, importFrom, makeProject, run } from "./helpers.mjs";

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
