import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, symlinkSync } from "node:fs";
import path from "node:path";
import { after, describe, it } from "node:test";
import { cleanUp, importFrom, makeProject, repoDirectory, run, write } from "./helpers.mjs";

after(cleanUp);

// Scenarios: docs/harness/context-audit/context-audit.feature. Rules: BR-0001 to BR-0005.

const tool = "tools/context-audit.mjs";
const isRoot = process.getuid?.() === 0;

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
  return { ...result, report: result.code !== 2 && result.stdout ? JSON.parse(result.stdout) : null };
}

const toolReport = (report, id) => report.tools.find((entry) => entry.tool === id);
const paths = (parts) => parts.map((part) => part.path);
const warned = (report, pattern) => report.warnings.some((warning) => pattern.test(warning));
const skill = (name, description) => `---\nname: ${name}\ndescription: ${description}\n---\n\n${"Body text. ".repeat(500)}`;

describe("context audit: what each tool loads", () => {
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
    assert.equal(claude.total, claude.parts.reduce((sum, part) => sum + part.tokens, 0));
    assert.equal(claude.overBudget, claude.total - 10000);
  });

  it("counts only the name and description of a skill, not its body", () => {
    const { report } = audit(project({ ".claude/skills/alpha/SKILL.md": skill("alpha", "Does alpha things") }));
    assert.ok(toolReport(report, "claude-code").parts[0].tokens < 20);
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

  it("reports Codex and OpenCode for a bare AGENTS.md", () => {
    const { report } = audit(project({ "AGENTS.md": "rules" }));
    assert.deepEqual(report.tools.map((entry) => entry.tool), ["codex", "opencode"]);
  });

  it("says no agent tool was found in an empty project, and exits 0", () => {
    const empty = run(project(), tool);
    assert.equal(empty.code, 0);
    assert.match(empty.stdout, /No agent tool found/);
  });
});

describe("context audit: Claude Code imports and rules", () => {
  // Imports resolve from the importing file's folder (RS-0001, finding 3).
  const chain = {
    "CLAUDE.md": "See @docs/a.md.",
    "docs/a.md": "A @b.md",
    "docs/b.md": "B @c.md",
    "docs/c.md": "C @d.md",
    "docs/d.md": "D @e.md",
    "docs/e.md": "E, five hops away",
  };

  it("follows imports up to four hops", () => {
    const { report } = audit(project(chain));
    assert.deepEqual(paths(toolReport(report, "claude-code").parts).sort(), ["CLAUDE.md", "docs/a.md", "docs/b.md", "docs/c.md", "docs/d.md"]);
  });

  it("warns about an import past four hops with its chain", () => {
    const { report } = audit(project(chain));
    assert.ok(warned(report, /docs\/e\.md.*four hops.*CLAUDE\.md → docs\/a\.md/));
  });

  it("counts a file imported twice once", () => {
    const { report } = audit(project({ "CLAUDE.md": "@docs/a.md @docs/b.md", "docs/a.md": "@b.md", "docs/b.md": "@a.md" }));
    assert.deepEqual(paths(toolReport(report, "claude-code").parts).sort(), ["CLAUDE.md", "docs/a.md", "docs/b.md"]);
  });

  it("does not warn about a cycle that reaches back to a counted file at the hop limit", () => {
    const { report } = audit(project({ "CLAUDE.md": "@d/a.md", "d/a.md": "@b.md", "d/b.md": "@c.md", "d/c.md": "@e.md", "d/e.md": "@../CLAUDE.md" }));
    assert.ok(!warned(report, /CLAUDE\.md is not counted/));
  });

  it("skips imports in code spans and fenced blocks", () => {
    const { report } = audit(project({ "CLAUDE.md": "`@docs/span.md`\n```\n@docs/fenced.md\n```\n", "docs/span.md": "x", "docs/fenced.md": "x" }));
    assert.deepEqual(paths(toolReport(report, "claude-code").parts), ["CLAUDE.md"]);
  });

  it("treats email addresses and mentions as text, not imports", () => {
    const { report } = audit(project({ "CLAUDE.md": "Mail me@example.com or ask @alice." }));
    assert.deepEqual(report.warnings, []);
  });

  it("warns about an import that does not exist", () => {
    assert.ok(warned(audit(project({ "CLAUDE.md": "@docs/missing.md" })).report, /docs\/missing\.md.*does not exist/));
  });

  it("warns about an import outside the project and does not count it", () => {
    const { report } = audit(project({ "CLAUDE.md": "@../outside.md" }));
    assert.ok(warned(report, /outside\.md.*outside the project/));
    assert.deepEqual(paths(toolReport(report, "claude-code").parts), ["CLAUDE.md"]);
  });

  it("counts rules without paths", () => {
    const { report } = audit(project({ "CLAUDE.md": "root", ".claude/rules/style.md": "Always style." }));
    assert.ok(paths(toolReport(report, "claude-code").parts).includes(".claude/rules/style.md"));
  });

  it("lists rules with paths as loaded on demand, outside the total", () => {
    const { report } = audit(project({ "CLAUDE.md": "root", ".claude/rules/api.md": "---\npaths: src/api/**\n---\nAPI rules." }));
    const claude = toolReport(report, "claude-code");
    assert.ok(!paths(claude.parts).includes(".claude/rules/api.md"));
    assert.deepEqual(paths(claude.onDemand), [".claude/rules/api.md"]);
  });

  it("strips block-level HTML comments before counting", () => {
    const { report } = audit(project({ "CLAUDE.md": `<!--\n${"hidden ".repeat(400)}\n-->\nshown` }));
    assert.ok(toolReport(report, "claude-code").parts[0].tokens < 10);
  });

  it("caps a description at 1,536 characters and warns that the rest is never seen", () => {
    const { report } = audit(project({ ".claude/skills/long/SKILL.md": skill("long", "d".repeat(3000)) }));
    const long = toolReport(report, "claude-code").parts[0];
    assert.match(long.note, /1,536/);
    assert.ok(long.tokens <= Math.ceil((1536 + "long".length + 1) / 4));
    assert.ok(warned(report, /long\/SKILL\.md.*1,536 characters/));
  });

  it("warns about a skill with no description", () => {
    assert.ok(warned(audit(project({ ".claude/skills/bare/SKILL.md": "No frontmatter here." })).report, /bare.*no description/));
  });
});

describe("context audit: folder-scoped files", () => {
  it("lists them with their tokens, outside every total", () => {
    const { report } = audit(project({ ".codex/": "", "AGENTS.md": "root", "packages/web/AGENTS.md": "w".repeat(12000) }));
    assert.deepEqual(report.folderScoped, [{ path: "packages/web/AGENTS.md", tokens: 3000 }]);
    assert.deepEqual(paths(toolReport(report, "codex").parts), ["AGENTS.md"]);
  });

  it("never searches node_modules or .git", () => {
    const { report } = audit(project({ "AGENTS.md": "root", "node_modules/pkg/AGENTS.md": "x", "web/.git/AGENTS.md": "x" }));
    assert.deepEqual(report.folderScoped, []);
  });

  it("searches templates/ and dot folders below the root", () => {
    const { report } = audit(project({ "AGENTS.md": "root", "templates/AGENTS.md": "a", "pkg/templates/AGENTS.md": "b", "web/.claude/CLAUDE.md": "c" }));
    assert.deepEqual(report.folderScoped.map((file) => file.path).sort(), ["pkg/templates/AGENTS.md", "templates/AGENTS.md", "web/.claude/CLAUDE.md"]);
  });

  it("skips the kit's own templates/ folder in the kit's repository", () => {
    const { report } = audit(project({ "AGENTS.md": "root", "templates/actions/harness.md": "kit", "templates/scrum/AGENTS.md": "kit" }));
    assert.deepEqual(report.folderScoped, []);
  });

  it("warns about an unreadable folder and still reports the rest", { skip: isRoot }, () => {
    const directory = project({ "AGENTS.md": "root", "private/AGENTS.md": "x" });
    chmodSync(path.join(directory, "private"), 0o000);
    try {
      const { code, report } = audit(directory);
      assert.equal(code, 0);
      assert.ok(warned(report, /private cannot be read/));
    } finally {
      chmodSync(path.join(directory, "private"), 0o755);
    }
  });
});

describe("context audit: unreadable and binary files", () => {
  it("leaves out an unreadable Codex AGENTS.md with a warning", { skip: isRoot }, () => {
    const directory = project({ ".codex/": "", "AGENTS.md": "y".repeat(40000) });
    chmodSync(path.join(directory, "AGENTS.md"), 0o000);
    try {
      const { report } = audit(directory);
      assert.deepEqual(toolReport(report, "codex").parts, []);
      assert.ok(warned(report, /AGENTS\.md cannot be read/));
    } finally {
      chmodSync(path.join(directory, "AGENTS.md"), 0o644);
    }
  });

  it("leaves out a binary instruction file with a warning", () => {
    const { report } = audit(project({ ".codex/": "", "AGENTS.md": "PK\0\u0003binary" }));
    assert.deepEqual(toolReport(report, "codex").parts, []);
    assert.ok(warned(report, /AGENTS\.md is binary/));
  });
});

describe("context audit: Codex", () => {
  it("fails when Codex would drop instruction text, even within the budget", () => {
    const { code, report } = audit(project({ ".codex/": "", "AGENTS.md": "y".repeat(40000) }), ["--budget", "50000"]);
    const codex = toolReport(report, "codex");
    assert.equal(code, 1);
    assert.deepEqual({ bytes: codex.instructionBytes, cap: codex.instructionCap, dropped: codex.droppedBytes }, { bytes: 40000, cap: 32768, dropped: 7232 });
    assert.ok(warned(report, /7,232 bytes/));
  });

  it("names the Codex drop, not the budget, as the reason it failed", () => {
    const text = run(project({ ".codex/": "", "AGENTS.md": "y".repeat(40000) }), tool, ["--budget", "50000"]).stdout;
    assert.match(text, /Result: Codex would drop instructions \(exit 1\)/);
  });

  it("reads the Codex cap from .codex/config.toml", () => {
    const { code, report } = audit(project({ ".codex/config.toml": "project_doc_max_bytes = 65536\n", "AGENTS.md": "y".repeat(40000) }), ["--budget", "50000"]);
    assert.equal(code, 0);
    assert.equal(toolReport(report, "codex").droppedBytes, 0);
  });

  it("warns about a bad Codex cap and uses the default", () => {
    const { report } = audit(project({ ".codex/config.toml": "project_doc_max_bytes = \"big\"\n", "AGENTS.md": "y" }));
    assert.equal(toolReport(report, "codex").instructionCap, 32768);
    assert.ok(warned(report, /project_doc_max_bytes/));
  });

  it("prefers AGENTS.override.md", () => {
    const { report } = audit(project({ ".codex/": "", "AGENTS.md": "base", "AGENTS.override.md": "override" }));
    assert.deepEqual(paths(toolReport(report, "codex").parts), ["AGENTS.override.md"]);
  });

  it("counts Codex skills and agents by description, and names its MCP servers", () => {
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
});

describe("context audit: OpenCode", () => {
  const opencodeProject = (extra = {}) =>
    project({
      "opencode.jsonc": `{\n  // project config\n  "instructions": ["**/rules/*.md", "https://example.com/rules.md",],\n  "mcp": { "servers": { "search": { "type": "remote" } } },\n}`,
      "AGENTS.md": "root",
      "docs/rules/one.md": "one",
      "docs/rules/two.md": "two",
      "node_modules/pkg/docs/rules/three.md": "never searched",
      ...extra,
    });

  it("counts instruction files and globs, outside node_modules", () => {
    const { report } = audit(opencodeProject());
    assert.deepEqual(paths(toolReport(report, "opencode").parts).sort(), ["AGENTS.md", "docs/rules/one.md", "docs/rules/two.md"]);
  });

  it("lists remote instructions without fetching them", () => {
    assert.deepEqual(toolReport(audit(opencodeProject()).report, "opencode").remoteInstructions, ["https://example.com/rules.md"]);
  });

  it("names MCP servers from mcp.servers", () => {
    assert.deepEqual(toolReport(audit(opencodeProject()).report, "opencode").mcpServers, [{ name: "search", upfront: false }]);
  });

  it("counts agent and skill descriptions", () => {
    const directory = opencodeProject({ ".opencode/agents/reviewer.md": "---\ndescription: Reviews code\n---\nBody", ".agents/skills/shared/SKILL.md": skill("shared", "Shared skill") });
    const counted = paths(toolReport(audit(directory).report, "opencode").parts);
    assert.ok(counted.includes(".opencode/agents/reviewer.md"));
    assert.ok(counted.includes(".agents/skills/shared/SKILL.md"));
  });

  it("refuses an instruction outside the project with a warning", () => {
    const { report } = audit(project({ "opencode.json": JSON.stringify({ instructions: ["../outside.md"] }), "AGENTS.md": "root" }));
    assert.deepEqual(paths(toolReport(report, "opencode").parts), ["AGENTS.md"]);
    assert.ok(warned(report, /\.\.\/outside\.md.*outside the project/));
  });

  it("keeps commas and brackets inside JSONC strings", () => {
    const { report } = audit(project({ "opencode.jsonc": '{ "instructions": ["docs/odd ,].md",], }', "AGENTS.md": "root", "docs/odd ,].md": "odd" }));
    assert.ok(paths(toolReport(report, "opencode").parts).includes("docs/odd ,].md"));
  });

  it("falls back to CLAUDE.md and reads legacy MCP config", () => {
    const opencode = toolReport(audit(project({ "opencode.json": JSON.stringify({ mcp: { legacy: { type: "local" } } }), "CLAUDE.md": "claude" })).report, "opencode");
    assert.deepEqual(paths(opencode.parts), ["CLAUDE.md"]);
    assert.deepEqual(opencode.mcpServers, [{ name: "legacy", upfront: false }]);
  });
});

describe("context audit: MCP servers and hooks", () => {
  it("names Claude Code servers and flags those that load upfront, without counting them", () => {
    const directory = project({ "CLAUDE.md": "root", ".mcp.json": JSON.stringify({ mcpServers: { docs: { command: "docs-mcp" }, db: { command: "db-mcp", alwaysLoad: true } } }) });
    const claude = toolReport(audit(directory).report, "claude-code");
    assert.deepEqual(claude.mcpServers, [{ name: "docs", upfront: false }, { name: "db", upfront: true }]);
    assert.deepEqual(paths(claude.parts), ["CLAUDE.md"]);
  });

  it("names SessionStart and UserPromptSubmit hooks and never runs them", () => {
    const directory = project({
      ".claude/settings.json": JSON.stringify({
        hooks: {
          SessionStart: [{ hooks: [{ type: "command", command: "touch ran.txt" }] }],
          UserPromptSubmit: [{ hooks: [{ type: "command", command: "node harness/gate.mjs brief" }] }],
          PreToolUse: [{ matcher: "Edit", hooks: [{ type: "command", command: "node harness/gate.mjs" }] }],
        },
      }),
    });
    assert.deepEqual(toolReport(audit(directory).report, "claude-code").hooks, [
      { event: "SessionStart", command: "touch ran.txt" },
      { event: "UserPromptSubmit", command: "node harness/gate.mjs brief" },
    ]);
    assert.equal(existsSync(path.join(directory, "ran.txt")), false);
  });

  it("names hooks from .claude/settings.local.json too", () => {
    const directory = project({ ".claude/settings.local.json": JSON.stringify({ hooks: { SessionStart: [{ hooks: [{ type: "command", command: "echo local" }] }] } }) });
    assert.deepEqual(toolReport(audit(directory).report, "claude-code").hooks, [{ event: "SessionStart", command: "echo local" }]);
  });

  it("flags every server upfront when tool search is off in the project settings", () => {
    const directory = project({ ".mcp.json": JSON.stringify({ mcpServers: { docs: {} } }), ".claude/settings.json": JSON.stringify({ env: { ENABLE_TOOL_SEARCH: "false" } }) });
    assert.deepEqual(toolReport(audit(directory).report, "claude-code").mcpServers, [{ name: "docs", upfront: true }]);
  });

  it("warns about a malformed tool config and still reports the rest", () => {
    const { code, report } = audit(project({ "CLAUDE.md": "root", ".mcp.json": "{ broken" }));
    assert.equal(code, 0);
    assert.deepEqual(paths(toolReport(report, "claude-code").parts), ["CLAUDE.md"]);
    assert.ok(warned(report, /\.mcp\.json/));
  });
});

describe("context audit: budget and exit codes", () => {
  it("exits 0 within the default budget", () => {
    assert.equal(audit(project({ "CLAUDE.md": "z".repeat(400) })).code, 0);
  });

  it("takes the budget from --budget", () => {
    assert.equal(audit(project({ "CLAUDE.md": "z".repeat(400) }), ["--budget", "50"]).code, 1);
  });

  it("takes the budget from tools/context-audit.json", () => {
    const directory = project({ "CLAUDE.md": "z".repeat(400), "tools/context-audit.json": JSON.stringify({ budget: 50 }) });
    const { code, report } = audit(directory);
    assert.equal(code, 1);
    assert.equal(report.budget, 50);
  });

  it("uses the default budget when called as a library", async () => {
    const directory = project({ "CLAUDE.md": "x" });
    const { auditProject } = await importFrom(directory, tool);
    const report = await auditProject(directory);
    assert.equal(report.budget, 10000);
    assert.equal(toolReport(report, "claude-code").overBudget, 0);
  });

  it("exits 2 on a budget that is not a positive whole number", () => {
    const directory = project({ "CLAUDE.md": "z" });
    for (const value of ["0", "-3", "ten", "1.5"]) {
      const result = run(directory, tool, ["--budget", value]);
      assert.equal(result.code, 2, value);
      assert.match(result.stderr, /--budget/);
    }
  });

  it("exits 2 on an unknown option", () => {
    assert.equal(run(project(), tool, ["--frobnicate"]).code, 2);
  });

  it("exits 2 on a malformed or non-object config", () => {
    for (const content of ["{ not json", "null", "[]", "3"]) {
      const result = run(project({ "tools/context-audit.json": content }), tool);
      assert.equal(result.code, 2, content);
      assert.match(result.stderr, /context-audit\.json/);
    }
  });

  it("runs when called through a symlinked path", () => {
    const directory = project({ "CLAUDE.md": "z".repeat(400) });
    const link = path.join(makeProject(), "link");
    symlinkSync(directory, link);
    const result = run(link, tool, ["--budget", "1"]);
    assert.equal(result.code, 1);
    assert.match(result.stdout, /Claude Code/);
  });
});

describe("context audit: counting and output", () => {
  it("marks every count as an estimate without js-tiktoken and says how to install it", () => {
    const directory = project({ "CLAUDE.md": "abcd", "packages/a/AGENTS.md": "efgh" });
    assert.equal(audit(directory).report.counter.method, "estimate");
    const text = run(directory, tool).stdout;
    assert.match(text, /npm install --save-dev js-tiktoken/);
    assert.match(text, /Claude Code: ≈1 of 10,000 tokens/);
    assert.match(text, /≈1 {2}CLAUDE\.md/);
    assert.match(text, /≈1 {2}packages\/a\/AGENTS\.md/);
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

  it("prints the same totals as text and as JSON, largest part first", () => {
    const directory = project({ ".claude/": "", "CLAUDE.md": "c".repeat(8000), ".claude/rules/small.md": "small" });
    const { report } = audit(directory);
    const text = run(directory, tool).stdout;
    const claude = toolReport(report, "claude-code");
    assert.ok(text.includes(`Claude Code: ≈${claude.total.toLocaleString("en-US")} of ${report.budget.toLocaleString("en-US")} tokens`));
    assert.ok(text.indexOf("CLAUDE.md") < text.indexOf(".claude/rules/small.md"));
  });
});
