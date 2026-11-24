import assert from "node:assert/strict";
import { existsSync, mkdirSync, symlinkSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { after, describe, it } from "node:test";
import { cleanUp, makeProject, repoDirectory, run, write } from "./helpers.mjs";

after(cleanUp);

// Scenarios: docs/harness/context-audit/context-audit.feature. Rules: BR-0001 to BR-0005.

const tool = "tools/context-audit.mjs";

function project(files = {}) {
  const directory = makeProject(["tools"]);
  for (const [file, content] of Object.entries(files)) {
    if (file.endsWith("/")) mkdirSync(path.join(directory, file), { recursive: true });
    else write(directory, file, content);
  }
  return directory;
}

function audit(directory, args = []) {
  const result = run(directory, tool, ["--json", ...args]);
  return { ...result, report: result.stdout ? JSON.parse(result.stdout) : null };
}

const toolReport = (report, id) => report.tools.find((entry) => entry.tool === id);
const paths = (parts) => parts.map((part) => part.path);
const skill = (name, description) => `---\nname: ${name}\ndescription: ${description}\n---\n\n${"Body text. ".repeat(500)}`;

describe("context audit", () => {
  it("names the largest file first and fails over the default budget", () => {
    const directory = project({
      ".claude/": "",
      "CLAUDE.md": "x".repeat(40000),
      ".claude/skills/alpha/SKILL.md": skill("alpha", "Does alpha things"),
      ".claude/skills/beta/SKILL.md": skill("beta", "Does beta things"),
    });
    const { code, report } = audit(directory);
    const claude = toolReport(report, "claude-code");
    assert.equal(code, 1);
    assert.deepEqual(paths(claude.parts), ["CLAUDE.md", ".claude/skills/alpha/SKILL.md", ".claude/skills/beta/SKILL.md"]);
    assert.equal(claude.parts[0].tokens, 10000);
    assert.ok(claude.parts[1].tokens < 20, "only the name and description count");
    assert.equal(claude.total, claude.parts.reduce((sum, part) => sum + part.tokens, 0));
    assert.equal(claude.overBudget, claude.total - 10000);
  });

  it("counts each tool's own instruction file", () => {
    const directory = project({ ".claude/": "", ".codex/": "", "CLAUDE.md": "a".repeat(400), "AGENTS.md": "b".repeat(800) });
    const { report } = audit(directory);
    assert.deepEqual(paths(toolReport(report, "claude-code").parts), ["CLAUDE.md"]);
    assert.deepEqual(paths(toolReport(report, "codex").parts), ["AGENTS.md"]);
    assert.equal(toolReport(report, "opencode"), undefined);
  });

  it("falls back to AGENTS.md for Claude Code when no CLAUDE file exists", () => {
    const { report } = audit(project({ ".claude/": "", "AGENTS.md": "rules" }));
    assert.deepEqual(paths(toolReport(report, "claude-code").parts), ["AGENTS.md"]);
  });

  it("counts CLAUDE.local.md and .claude/CLAUDE.md with CLAUDE.md", () => {
    const { report } = audit(project({ "CLAUDE.md": "a", "CLAUDE.local.md": "bb", ".claude/CLAUDE.md": "ccc", "AGENTS.md": "d" }));
    assert.deepEqual(paths(toolReport(report, "claude-code").parts).sort(), [".claude/CLAUDE.md", "CLAUDE.local.md", "CLAUDE.md"]);
  });

  it("follows imports up to four hops, once each, and skips code and email addresses", () => {
    const directory = project({
      "CLAUDE.md": "See @docs/a.md and me@example.com.\n`@docs/span.md`\n```\n@docs/fenced.md\n```\n",
      // Imports resolve from the importing file's folder (RS-0001, finding 3).
      "docs/a.md": "A @b.md",
      "docs/b.md": "B @a.md @c.md",
      "docs/c.md": "C @d.md",
      "docs/d.md": "D @e.md",
      "docs/e.md": "E, five hops away",
      "docs/span.md": "never",
      "docs/fenced.md": "never",
    });
    const { report } = audit(directory);
    const counted = paths(toolReport(report, "claude-code").parts);
    assert.deepEqual(counted.sort(), ["CLAUDE.md", "docs/a.md", "docs/b.md", "docs/c.md", "docs/d.md"]);
    assert.ok(report.warnings.some((warning) => /docs\/e\.md/.test(warning) && /four/.test(warning)));
  });

  it("warns about an import that is missing or outside the project, and ignores mentions", () => {
    const { report } = audit(project({ "CLAUDE.md": "@docs/missing.md @../outside.md Ask @alice." }));
    assert.ok(!report.warnings.some((warning) => /alice/.test(warning)));
    assert.ok(report.warnings.some((warning) => /docs\/missing\.md/.test(warning)));
    assert.ok(report.warnings.some((warning) => /outside\.md/.test(warning)));
  });

  it("counts rules without paths and lists rules with paths as loaded on demand", () => {
    const directory = project({
      "CLAUDE.md": "root",
      ".claude/rules/style.md": "Always style.",
      ".claude/rules/api.md": "---\npaths: src/api/**\n---\nAPI rules.",
    });
    const claude = toolReport(audit(directory).report, "claude-code");
    assert.ok(paths(claude.parts).includes(".claude/rules/style.md"));
    assert.ok(!paths(claude.parts).includes(".claude/rules/api.md"));
    assert.deepEqual(paths(claude.onDemand), [".claude/rules/api.md"]);
  });

  it("strips block-level HTML comments from Claude files before counting", () => {
    const { report } = audit(project({ "CLAUDE.md": `<!--\n${"hidden ".repeat(400)}\n-->\nshown` }));
    assert.ok(toolReport(report, "claude-code").parts[0].tokens < 10);
  });

  it("lists folder-scoped files outside every total and skips dependency folders", () => {
    const directory = project({
      ".codex/": "",
      "AGENTS.md": "root",
      "packages/web/AGENTS.md": "w".repeat(12000),
      "node_modules/pkg/AGENTS.md": "ignored",
      "templates/AGENTS.md": "ignored",
    });
    const { report } = audit(directory);
    assert.deepEqual(report.folderScoped.map((entry) => entry.path), ["packages/web/AGENTS.md"]);
    assert.equal(report.folderScoped[0].tokens, 3000);
    assert.deepEqual(paths(toolReport(report, "codex").parts), ["AGENTS.md"]);
  });

  it("fails when Codex would drop instruction text, even within the budget", () => {
    const { code, report } = audit(project({ ".codex/": "", "AGENTS.md": "y".repeat(40000) }), ["--budget", "50000"]);
    const codex = toolReport(report, "codex");
    assert.equal(code, 1);
    assert.deepEqual({ bytes: codex.instructionBytes, cap: codex.instructionCap, dropped: codex.droppedBytes }, { bytes: 40000, cap: 32768, dropped: 7232 });
    assert.ok(report.warnings.some((warning) => /7,232 bytes/.test(warning)));
  });

  it("reads the Codex cap from .codex/config.toml, and warns on a bad value", () => {
    const raised = audit(project({ ".codex/config.toml": "project_doc_max_bytes = 65536\n", "AGENTS.md": "y".repeat(40000) }), ["--budget", "50000"]);
    assert.equal(raised.code, 0);
    assert.equal(toolReport(raised.report, "codex").droppedBytes, 0);
    const bad = audit(project({ ".codex/config.toml": "project_doc_max_bytes = \"big\"\n", "AGENTS.md": "y" }));
    assert.equal(toolReport(bad.report, "codex").instructionCap, 32768);
    assert.ok(bad.report.warnings.some((warning) => /project_doc_max_bytes/.test(warning)));
  });

  it("prefers AGENTS.override.md for Codex", () => {
    const { report } = audit(project({ ".codex/": "", "AGENTS.md": "base", "AGENTS.override.md": "override" }));
    assert.deepEqual(paths(toolReport(report, "codex").parts), ["AGENTS.override.md"]);
  });

  it("exits 0 within budget and takes the budget from the config or the flag", () => {
    const directory = project({ "CLAUDE.md": "z".repeat(400) });
    assert.equal(audit(directory).code, 0);
    assert.equal(audit(directory, ["--budget", "50"]).code, 1);
    write(directory, "tools/context-audit.json", JSON.stringify({ budget: 50 }));
    const configured = audit(directory);
    assert.equal(configured.code, 1);
    assert.equal(configured.report.budget, 50);
  });

  it("uses the default budget when called as a library", async () => {
    const directory = project({ "CLAUDE.md": "x" });
    const { auditProject } = await import(`${pathToFileURL(path.join(directory, tool)).href}?t=${Math.random()}`);
    const report = await auditProject(directory);
    assert.equal(report.budget, 10000);
    assert.equal(toolReport(report, "claude-code").overBudget, 0);
  });

  it("exits 2 on a bad budget or a malformed config", () => {
    const directory = project({ "CLAUDE.md": "z" });
    for (const value of ["0", "-3", "ten", "1.5"]) {
      const result = run(directory, tool, ["--budget", value]);
      assert.equal(result.code, 2, value);
      assert.match(result.stderr, /--budget/);
    }
    assert.equal(run(directory, tool, ["--frobnicate"]).code, 2);
    write(directory, "tools/context-audit.json", "{ not json");
    const malformed = run(directory, tool);
    assert.equal(malformed.code, 2);
    assert.match(malformed.stderr, /context-audit\.json/);
  });

  it("names MCP servers and context hooks without counting or running them", () => {
    const directory = project({
      "CLAUDE.md": "root",
      ".mcp.json": JSON.stringify({ mcpServers: { docs: { command: "docs-mcp" }, db: { command: "db-mcp", alwaysLoad: true } } }),
      ".claude/settings.json": JSON.stringify({
        hooks: {
          SessionStart: [{ hooks: [{ type: "command", command: "touch ran.txt" }] }],
          UserPromptSubmit: [{ hooks: [{ type: "command", command: "node harness/gate.mjs brief" }] }],
          PreToolUse: [{ matcher: "Edit", hooks: [{ type: "command", command: "node harness/gate.mjs" }] }],
        },
      }),
    });
    const claude = toolReport(audit(directory).report, "claude-code");
    assert.deepEqual(claude.mcpServers, [{ name: "docs", upfront: false }, { name: "db", upfront: true }]);
    assert.deepEqual(claude.hooks, [
      { event: "SessionStart", command: "touch ran.txt" },
      { event: "UserPromptSubmit", command: "node harness/gate.mjs brief" },
    ]);
    assert.deepEqual(paths(claude.parts), ["CLAUDE.md"]);
    assert.equal(existsSync(path.join(directory, "ran.txt")), false);
  });

  it("flags every Claude Code server upfront when tool search is off in the project settings", () => {
    const directory = project({
      ".mcp.json": JSON.stringify({ mcpServers: { docs: {} } }),
      ".claude/settings.json": JSON.stringify({ env: { ENABLE_TOOL_SEARCH: "false" } }),
    });
    assert.deepEqual(toolReport(audit(directory).report, "claude-code").mcpServers, [{ name: "docs", upfront: true }]);
  });

  it("warns about a malformed third-party config and still reports the rest", () => {
    const { code, report } = audit(project({ "CLAUDE.md": "root", ".mcp.json": "{ broken" }));
    assert.equal(code, 0);
    assert.deepEqual(paths(toolReport(report, "claude-code").parts), ["CLAUDE.md"]);
    assert.ok(report.warnings.some((warning) => /\.mcp\.json/.test(warning)));
  });

  it("reads OpenCode instructions, servers, skills, and agents, and lists URLs without fetching them", () => {
    const directory = project({
      "opencode.jsonc": `{\n  // project config\n  "instructions": ["**/rules/*.md", "https://example.com/rules.md"],\n  "mcp": { "servers": { "search": { "type": "remote" } } }\n}`,
      "AGENTS.md": "root",
      "docs/rules/one.md": "one",
      "docs/rules/two.md": "two",
      "node_modules/pkg/docs/rules/three.md": "never searched",
      ".opencode/agents/reviewer.md": "---\ndescription: Reviews code\n---\nBody",
      ".agents/skills/shared/SKILL.md": skill("shared", "Shared skill"),
    });
    const opencode = toolReport(audit(directory).report, "opencode");
    assert.deepEqual(paths(opencode.parts).sort(), [".agents/skills/shared/SKILL.md", ".opencode/agents/reviewer.md", "AGENTS.md", "docs/rules/one.md", "docs/rules/two.md"]);
    assert.deepEqual(opencode.mcpServers, [{ name: "search", upfront: false }]);
    assert.deepEqual(opencode.remoteInstructions, ["https://example.com/rules.md"]);
  });

  it("falls back to CLAUDE.md for OpenCode and reads legacy MCP config", () => {
    const directory = project({ "opencode.json": JSON.stringify({ mcp: { legacy: { type: "local" } } }), "CLAUDE.md": "claude" });
    const opencode = toolReport(audit(directory).report, "opencode");
    assert.deepEqual(paths(opencode.parts), ["CLAUDE.md"]);
    assert.deepEqual(opencode.mcpServers, [{ name: "legacy", upfront: false }]);
  });

  it("counts Codex skills and agents by description", () => {
    const directory = project({
      "AGENTS.md": "root",
      ".agents/skills/fmt/SKILL.md": skill("fmt", "Formats code"),
      ".codex/agents/reviewer.toml": 'name = "reviewer"\ndescription = "Reviews code"\ndeveloper_instructions = """\nLong body\n"""\n',
      ".codex/config.toml": '[mcp_servers.docs]\ncommand = "docs-mcp"\n',
    });
    const codex = toolReport(audit(directory).report, "codex");
    assert.deepEqual(paths(codex.parts).sort(), [".agents/skills/fmt/SKILL.md", ".codex/agents/reviewer.toml", "AGENTS.md"]);
    assert.deepEqual(codex.mcpServers, [{ name: "docs", upfront: false }]);
  });

  it("caps Claude Code descriptions at 1,536 characters and warns about missing ones", () => {
    const directory = project({
      ".claude/skills/long/SKILL.md": skill("long", "d".repeat(3000)),
      ".claude/skills/bare/SKILL.md": "No frontmatter here.",
    });
    const { report } = audit(directory);
    const long = toolReport(report, "claude-code").parts.find((part) => part.path.includes("long"));
    assert.match(long.note, /1,536/);
    assert.ok(long.tokens <= Math.ceil((1536 + "long".length + 1) / 4));
    assert.ok(report.warnings.some((warning) => /bare/.test(warning) && /description/.test(warning)));
  });

  it("estimates without js-tiktoken and says how to install it", () => {
    const directory = project({ "CLAUDE.md": "abcd" });
    const { report } = audit(directory);
    assert.equal(report.counter.method, "estimate");
    const text = run(directory, tool);
    assert.match(text.stdout, /npm install --save-dev js-tiktoken/);
    assert.match(text.stdout, /estimate: characters ÷ 4/);
  });

  it("counts with o200k_base when the project has js-tiktoken", { skip: !existsSync(path.join(repoDirectory, "node_modules/js-tiktoken")) }, () => {
    const directory = project({ "CLAUDE.md": "hello world" });
    mkdirSync(path.join(directory, "node_modules"));
    symlinkSync(path.join(repoDirectory, "node_modules/js-tiktoken"), path.join(directory, "node_modules/js-tiktoken"));
    const { report } = audit(directory);
    assert.equal(report.counter.method, "o200k_base");
    assert.equal(toolReport(report, "claude-code").parts[0].tokens, 2);
    assert.match(run(directory, tool).stdout, /o200k_base.*approximate for Claude/);
  });

  it("reports Codex and OpenCode for a bare AGENTS.md, and nothing for an empty project", () => {
    const bare = audit(project({ "AGENTS.md": "rules" })).report;
    assert.deepEqual(bare.tools.map((entry) => entry.tool), ["codex", "opencode"]);
    const empty = run(project(), tool);
    assert.equal(empty.code, 0);
    assert.match(empty.stdout, /No agent tool found/);
  });

  it("prints the same totals as text and as JSON, largest part first", () => {
    const directory = project({ ".claude/": "", "CLAUDE.md": "c".repeat(8000), ".claude/rules/small.md": "small" });
    const { report } = audit(directory);
    const text = run(directory, tool).stdout;
    const claude = toolReport(report, "claude-code");
    assert.match(text, /Claude Code/);
    assert.ok(text.includes(`${claude.total.toLocaleString("en-US")} of ${report.budget.toLocaleString("en-US")} tokens`));
    assert.ok(text.indexOf("CLAUDE.md") < text.indexOf(".claude/rules/small.md"));
  });
});
