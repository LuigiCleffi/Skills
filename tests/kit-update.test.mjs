import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { cleanUp, importFrom, makeProject, run, write } from "./helpers.mjs";

after(cleanUp);

describe("kit update notice", () => {
  it("compares versions and builds the update command from the installed groups", async () => {
    const update = await importFrom(makeProject(["tools"]), "tools/kit-update.mjs");
    assert.equal(update.compareVersions("1.10.0", "1.9.3"), 1);
    assert.equal(update.compareVersions("1.5.0", "1.5.0"), 0);
    assert.equal(update.compareVersions("1.6.0-beta.1", "1.6.0"), -1);
    assert.equal(update.updateMessage("1.5.0", "1.5.0"), null);
    assert.equal(update.updateMessage("1.6.0", "1.5.0"), null);
    assert.match(update.updateMessage("1.4.0", "1.5.0", ["dev", "qa"]), /skills-code-kit 1\.5\.0 is out; this project has 1\.4\.0\..*npx skills-code-kit@1\.5\.0 install --groups dev,qa --yes/);
  });

  it("says nothing and lets the session start without a lock", () => {
    const project = makeProject(["tools"]);
    assert.deepEqual(run(project, "tools/kit-update.mjs"), { code: 0, stdout: "", stderr: "" });
    write(project, ".skills-code-kit/lock.json", "not json");
    assert.equal(run(project, "tools/kit-update.mjs").code, 0);
  });
});
