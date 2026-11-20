import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { cleanUp, importFrom, makeProject, run, write } from "./helpers.mjs";

after(cleanUp);

describe("doctor", () => {
  it("checks commands, their output, and paths, without changing anything", async () => {
    const project = makeProject(["tools"]);
    const doctor = await importFrom(project, "tools/doctor.mjs");
    write(project, "node_modules/.keep", "");
    const exec = (command) => {
      if (command === "node --version") return "v22.1.0\n";
      if (command === "old --version") return "v18.0.0\n";
      throw Object.assign(new Error("failed"), { stderr: "gh: not logged in\n" });
    };
    const results = doctor.report({
      checks: [
        { name: "node", run: "node --version", expect: "^v(2\\d|[3-9]\\d)\\." },
        { name: "old", run: "old --version", expect: "^v(2\\d|[3-9]\\d)\\.", fix: "upgrade" },
        { name: "deps", exists: "node_modules" },
        { name: "gh", run: "gh auth status", fix: "gh auth login", optional: true },
      ],
    }, project, exec);
    assert.deepEqual(results.map((result) => [result.name, result.ok]), [["node", true], ["old", false], ["deps", true], ["gh", false]]);
    assert.equal(results[3].detail, "gh: not logged in");
  });

  it("lists fixes and requests, and fails only on required checks", () => {
    const project = makeProject(["tools"]);
    write(project, "tools/doctor.json", JSON.stringify({
      checks: [
        { name: "Runtime", run: "node --version" },
        { name: "Settings", exists: ".env.local", fix: "cp .env.example .env.local", optional: true },
        { name: "Access", run: "node -e \"process.exit(1)\"", ask: "Please give me access.", optional: true },
      ],
    }));
    const ok = run(project, "tools/doctor.mjs");
    assert.equal(ok.code, 0);
    assert.match(ok.stdout, /✓ Runtime\n– Settings \(only needed for some tasks\)\n {4}fix: cp \.env\.example \.env\.local\n– Access.*\n {4}ask: Please give me access\.\n\nReady to work\./);
    write(project, "tools/doctor.json", JSON.stringify({ checks: [{ name: "Missing", exists: "nope", fix: "make it" }] }));
    assert.equal(run(project, "tools/doctor.mjs").code, 1);
    assert.equal(JSON.parse(run(project, "tools/doctor.mjs", ["--json"]).stdout)[0].ok, false);
  });
});
