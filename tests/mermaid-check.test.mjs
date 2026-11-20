import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { cleanUp, importFrom, makeProject, run, write } from "./helpers.mjs";

after(cleanUp);

describe("mermaid check", () => {
  it("finds mermaid blocks with their line, and skips examples inside a longer fence", async () => {
    const { mermaidBlocks } = await importFrom(makeProject(["tools"]), "tools/mermaid-check.mjs");
    const text = "# Doc\n\n```mermaid\nflowchart LR\n  A --> B\n```\n\n````md\n```mermaid\nexample\n```\n````\n\n~~~ mermaid\ngraph TD\n~~~\n```js\nx\n```\n";
    assert.deepEqual(mermaidBlocks(text), [
      { line: 3, source: "flowchart LR\n  A --> B" },
      { line: 14, source: "graph TD" },
    ]);
  });

  it("says it cannot run (exit 2) without the project's mermaid and jsdom, and passes files with no diagrams", () => {
    const project = makeProject(["tools"]);
    write(project, "a.md", "```mermaid\nflowchart LR\n  A --> B\n```\n");
    write(project, "b.md", "# no diagrams\n");
    const missing = run(project, "tools/mermaid-check.mjs", ["a.md"]);
    assert.equal(missing.code, 2);
    assert.match(missing.stderr, /npm install -D mermaid jsdom/);
    assert.equal(run(project, "tools/mermaid-check.mjs", ["b.md"]).code, 0);
  });
});
