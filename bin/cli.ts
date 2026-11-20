#!/usr/bin/env node

import { checkbox, confirm, select } from "@inquirer/prompts";
import {
  access,
  copyFile,
  mkdir,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import {
  type AgentTool,
  agentTools,
  detectAgentTools,
  generateAgentFiles,
} from "./agents.js";
import { classify, hashContent, hashFile, readLock, verifyProject, writeLock } from "./lock.js";
import { detectMcpClients, mcpClients, registerMcpServer } from "./mcpConfig.js";

type Skill = {
  value: string;
  name: string;
  description: string;
  // Entry points listed in the generated AGENTS.md.
  files: string[];
  // Template directories installed in full, alongside the entry points.
  directories?: string[];
  // Other groups this one routes to; installed with it.
  requires?: string[];
};

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFile);

// Compiled CLI is located in dist/cli.js.
// Templates are located in the package root's templates/ directory.
const packageDirectory = path.resolve(currentDirectory, "..");
const templateDirectory = path.join(packageDirectory, "templates");
const projectDirectory = process.cwd();

// Answers given on the command line. Each one replaces its question; with
// --yes, every question left takes its default, so agents and CI can install
// without a terminal.
type InstallOptions = {
  yes: boolean;
  groups?: string[];
  playwright?: boolean;
  agents?: string[];
  harness?: "warn" | "block" | "none";
  guards?: boolean;
  checks?: boolean;
  worktreeHook?: boolean;
  harnessHelpers?: boolean;
  mcp?: string[];
  overwrite: boolean;
};

let options: InstallOptions = { yes: false, overwrite: false };

const usage = `Usage: npx skills-code-kit [command] [options]

Commands:
  install          Install instruction groups into this project (default)
  list             List the instruction groups and what each requires
  verify           Report installed files changed, deleted, or outdated since install
  mcp              Serve the MCP server over stdio
  help             Show this help

Install options (each one answers its question; the rest are asked):
  --all                    Install every group
  --groups a,b             Install these groups (and the groups they require)
  --yes, -y                Do not ask: unanswered questions take their default
                           (Playwright only if configured, agents for the AI
                           tools found, harness hook "warn", harness helpers,
                           guards, checks and worktree hooks on,
                           no MCP server, never overwrite edited files)
  --playwright / --no-playwright
  --agents claude,opencode,codex   Scrum role agents for these tools ("none" for none)
  --harness warn|block|none        The harness gate hook in Claude Code
  --guards / --no-guards           The guards hook in Claude Code
  --harness-helpers / --no-harness-helpers
                                   Brief the agent on the run at each prompt, and check
                                   the format of issues it saves through a tracker's MCP
  --checks / --no-checks           The hook that refuses a pull request from an unchecked commit
  --worktree-hook / --no-worktree-hook
                                   Assign the worktree slot when a Claude Code session starts
  --mcp claude,opencode,codex      Register the MCP server with these clients ("none" for none)
  --overwrite              Overwrite files edited since install (default: keep them)

  --version, -v            Print the version

Example (no questions asked):
  npx skills-code-kit install --groups dev,review,tdd,harness --yes
`;

function list(value: string | undefined): string[] | undefined {
  if (value === undefined) return undefined;
  const items = value.split(",").map((item) => item.trim()).filter(Boolean);
  return items.length === 1 && items[0] === "none" ? [] : items;
}

function checkValues(flag: string, values: string[] | undefined, known: string[]): void {
  const unknown = (values ?? []).filter((value) => !known.includes(value));
  if (unknown.length > 0) {
    throw new UsageError(`Unknown ${flag}: ${unknown.join(", ")}. Choose from: ${known.join(", ")}.`);
  }
}

class UsageError extends Error {}

function parseInstallOptions(args: string[]): InstallOptions {
  const { values } = parseArgs({
    args,
    allowPositionals: false,
    options: {
      all: { type: "boolean" },
      groups: { type: "string" },
      yes: { type: "boolean", short: "y" },
      playwright: { type: "boolean" },
      "no-playwright": { type: "boolean" },
      agents: { type: "string" },
      harness: { type: "string" },
      guards: { type: "boolean" },
      "no-guards": { type: "boolean" },
      checks: { type: "boolean" },
      "no-checks": { type: "boolean" },
      "worktree-hook": { type: "boolean" },
      "harness-helpers": { type: "boolean" },
      "no-harness-helpers": { type: "boolean" },
      "no-worktree-hook": { type: "boolean" },
      mcp: { type: "string" },
      overwrite: { type: "boolean" },
    },
  });

  if (values.all && values.groups) throw new UsageError("Use either --all or --groups, not both.");
  const groups = values.all ? skills.map((skill) => skill.value) : list(values.groups);
  checkValues("group", groups, skills.map((skill) => skill.value));
  if (groups && groups.length === 0) throw new UsageError("--groups needs at least one group.");

  const agents = list(values.agents);
  checkValues("agent tool", agents, agentTools.map((tool) => tool.value));
  const mcp = list(values.mcp);
  checkValues("MCP client", mcp, mcpClients.map((client) => client.value));

  const harness = values.harness;
  if (harness !== undefined && !["warn", "block", "none"].includes(harness)) {
    throw new UsageError(`--harness takes warn, block, or none, not "${harness}".`);
  }

  const flag = (on?: boolean, off?: boolean) => (on ? true : off ? false : undefined);

  return {
    yes: values.yes ?? false,
    groups,
    playwright: flag(values.playwright, values["no-playwright"]),
    agents,
    harness: harness as InstallOptions["harness"],
    guards: flag(values.guards, values["no-guards"]),
    checks: flag(values.checks, values["no-checks"]),
    worktreeHook: flag(values["worktree-hook"], values["no-worktree-hook"]),
    harnessHelpers: flag(values["harness-helpers"], values["no-harness-helpers"]),
    mcp,
    overwrite: values.overwrite ?? false,
  };
}

// Returns the answer given on the command line, the default under --yes, or
// asks. Without a terminal and without --yes it stops instead of hanging.
async function answer<T>(
  flag: string,
  given: T | undefined,
  fallback: () => T | Promise<T>,
  ask: () => Promise<T>,
): Promise<T> {
  if (given !== undefined) return given;
  if (options.yes) return fallback();
  if (!process.stdin.isTTY) {
    throw new UsageError(
      `This needs an answer (${flag}) and there is no terminal to ask in. Pass ${flag}, or --yes to take the defaults.`,
    );
  }
  return ask();
}

const skills: Skill[] = [
  {
    value: "clean-code",
    name: "Clean Code standards",
    description: "Core principles, elegance, and code quality",
    files: ["CleanCode/README.md"],
    directories: ["CleanCode"],
  },
  {
    value: "dev",
    name: "Development workflow",
    description: "Guidelines for implementing features and fixing bugs",
    files: ["actions/dev.md"],
  },
  {
    value: "review",
    name: "Code review",
    description: "Review standards and quality checks",
    files: ["actions/review.md", "tools/review-context.mjs"],
  },
  {
    value: "code-review",
    name: "Standards and spec code review",
    description: "Two-axis review of a committed diff against repo standards, the knowledge base, and the spec",
    files: ["actions/code-review.md", "tools/review-context.mjs"],
  },
  {
    value: "adr",
    name: "Architecture decision records",
    description: "One ADR per architectural decision, plus the gate that routes each task to the ADRs that govern it",
    files: ["actions/adr.md"],
  },
  {
    value: "knowledge",
    name: "Business knowledge base",
    description: "Glossary, one file per business rule, and research notes in docs/knowledge/, behind a gate every stage consults",
    files: ["actions/knowledge.md"],
  },
  {
    value: "research",
    name: "Domain research",
    description: "Cited online research into the domain's laws, standards, and practice before the spec, proposing rules for the user to confirm",
    files: ["actions/research.md"],
    requires: ["knowledge"],
  },
  {
    value: "harness",
    name: "Spec-driven harness",
    description: "Runs every stage in order with a run record in docs/harness/, and a gate that warns (or, if you choose, blocks) when code is edited before the pre-code stages are settled",
    files: ["actions/harness.md", "harness/gate.mjs", "harness/config.json"],
    requires: ["product", "research", "knowledge", "adr", "dev", "tdd", "review", "qa"],
  },
  {
    value: "qa",
    name: "QA that runs and proves",
    description: "One scenario per acceptance criterion and per applicable edge-case row, each run for real with evidence, in a report in docs/qa/reports/",
    files: ["actions/qa.md", "actions/test-guide.md", "docs/qa/edge-cases.md"],
  },
  {
    value: "worktrees",
    name: "Worktree slots for parallel sessions",
    description: "Gives each git worktree its own ports and database name, so several agent sessions can run the app at once",
    files: ["tools/worktree-slot.mjs", "tools/worktree.json"],
  },
  {
    value: "cycle-metrics",
    name: "Cycle metrics",
    description: "tools/cycle-metrics.mjs: the numbers of a sprint or any window from git and GitHub (merged pull requests, time to merge and to a first look, reviewless merges, size, CI failures, reverts, releases, escaped defects), each next to the previous window, with fixed definitions",
    files: ["tools/cycle-metrics.mjs"],
  },
  {
    value: "design-rules",
    name: "Interface rules with IDs",
    description: "docs/design/RULES.md: the product's interface rules with stable IDs (laws, components, tokens, motion, data, writing, permissions, accessibility, verification) and the defects that must not come back, routed by what is being built",
    files: ["actions/design-rules.md", "docs/design/RULES.md"],
  },
  {
    value: "writing-style",
    name: "Plain answers writing style",
    description: "A Claude Code output style: answer first, behavior instead of internals, numbers instead of adjectives, what is not done stated plainly, size that follows the stakes",
    files: [".claude/output-styles/plain-answers.md"],
  },
  {
    value: "ui-review",
    name: "UI review gate",
    description: "Every screen a change touches, seen in each state (full, empty, loading, error, no permission), at four widths, after a reload, with an accessibility scan and no hard-coded design values",
    files: ["actions/ui-review.md"],
  },
  {
    value: "pr-review",
    name: "Pull request review assistant",
    description: "Helps a person review someone else's pull request: a three-line summary, what no check covered, each decision walked through, and a drafted review published only on their OK",
    files: ["actions/pr-review.md"],
  },
  {
    value: "explore",
    name: "Explore an idea",
    description: "Think an idea through before any plan: the real problem, an honest objection, two or three options with their cost, and a decision to go ahead, wait, or drop it",
    files: ["actions/explore.md"],
  },
  {
    value: "finish",
    name: "Finish after the merge",
    description: "After a merge: prove it landed, close the harness run, remove the worktree and merged branches, keep the lessons, and suggest a tag",
    files: ["actions/finish.md"],
  },
  {
    value: "checks",
    name: "Checks before a pull request",
    description: "Runs the checks a commit's diff reaches and stamps the commit; a Claude Code hook refuses to open a pull request from a commit with no stamp",
    files: ["checks/checks.mjs", "checks/config.json", "tools/mermaid-check.mjs"],
  },
  {
    value: "guards",
    name: "Guards against irreversible damage",
    description: "A Claude Code hook that refuses reading or leaking secrets, writing protected files such as migrations, destructive shell commands, and commits to protected branches",
    files: ["guards/guard.mjs", "guards/config.json"],
  },
  {
    value: "tdd",
    name: "Test-driven development",
    description: "Testing workflow and the TDD test pattern library",
    files: ["actions/tdd.md", "TDD/README.md", "docs/qa/edge-cases.md"],
    directories: ["TDD"],
  },
  {
    value: "ddd",
    name: "Domain-driven design",
    description: "Domain modeling, ubiquitous language, and the DDD pattern library",
    files: ["actions/ddd.md", "DDD/README.md"],
    directories: ["DDD"],
  },
  {
    value: "bdd",
    name: "Behavior-driven development",
    description: "Examples, executable Gherkin scenarios, and the BDD pattern library",
    files: ["actions/bdd.md", "BDD/README.md", "docs/qa/edge-cases.md"],
    directories: ["BDD"],
  },
  {
    value: "javascript",
    name: "JavaScript",
    description: "Idiomatic JavaScript for dev, tdd, bdd, and review: language, browser, and Node.js",
    files: ["JavaScript/README.md"],
    directories: ["JavaScript"],
  },
  {
    value: "llm",
    name: "LLMs and machine learning systems",
    description: "Foundation-model apps, prompts, RAG, agents, evaluation, fine-tuning, LLM internals, and production ML systems",
    files: ["LLM/README.md"],
    directories: ["LLM"],
  },
  {
    value: "dba",
    name: "Databases (DBA): Oracle and PostgreSQL",
    description: "SQL, schema design, security, tuning, and administration per engine",
    files: ["DBA/README.md"],
    directories: ["DBA"],
  },
  {
    value: "data-systems",
    name: "Data-intensive systems",
    description: "Data models, storage, replication, partitioning, transactions, batch and stream processing",
    files: ["DataSystems/README.md"],
    directories: ["DataSystems"],
  },
  {
    value: "devops",
    name: "DevOps and cloud infrastructure",
    description: "Delivery practices, IaC, CI/CD, monitoring, and AWS or Azure per platform",
    files: ["DevOps/README.md"],
    directories: ["DevOps"],
  },
  {
    value: "marketing",
    name: "Marketing and product strategy",
    description: "Strategy review of specs, plus the strategy, positioning, marketing, and persuasion library",
    files: ["actions/strategy.md", "Marketing/README.md"],
    directories: ["Marketing"],
  },
  {
    value: "product",
    name: "Product definition",
    description: "Planning and specification templates",
    files: [
      "ProductDefinition/plan.md",
      "ProductDefinition/specs/spec-definition.md",
      "ProductDefinition/specs/spec-checklist.md",
    ],
  },
  {
    value: "uiux",
    name: "UI/UX decisions",
    description: "Design handoff between specs and dev, plus the UI/UX skill library",
    files: ["actions/uiux.md", "UIUX/README.md"],
    directories: ["UIUX"],
  },
  {
    value: "pull-request",
    name: "Pull requests",
    description: "Open a pull request a person reviews in minutes: the template (what changed, why, human test steps, before and after screenshots), a QA script comment, CI watched until green, and review comments triaged",
    files: ["actions/pr.md", ".github/pull_request_template.md"],
  },
  {
    value: "scrum",
    name: "Scrum team of role agents",
    description: "PO, PM, Tech Lead, Dev, DBA, and DevOps roles, the ceremonies, and a board in docs/scrum/",
    files: ["scrum/README.md"],
    directories: ["scrum"],
    requires: [
      "product",
      "adr",
      "ddd",
      "bdd",
      "uiux",
      "dev",
      "tdd",
      "review",
      "code-review",
      "pull-request",
    ],
  },
];

const playwrightConfigs = [
  "playwright.config.ts",
  "playwright.config.js",
  "playwright.config.mjs",
  "playwright.config.cjs",
];

// Delivery stages in the order an agent should follow them.
const workflowStages: { skill: string; step: string }[] = [
  { skill: "product", step: "`ProductDefinition/plan.md` — the product plan" },
  {
    skill: "research",
    step: "`actions/research.md` — cited domain research, when the domain is unfamiliar, regulated, or rule-heavy",
  },
  {
    skill: "product",
    step: "`ProductDefinition/specs/spec-definition.md`, then `ProductDefinition/specs/spec-checklist.md`",
  },
  {
    skill: "marketing",
    step: "`actions/strategy.md` — strategy review against the marketing knowledge base, when the change is customer-facing or the product is a marketing tool",
  },
  {
    skill: "ddd",
    step: "`actions/ddd.md` — domain model and ubiquitous language, when the change touches domain concepts or rules",
  },
  {
    skill: "bdd",
    step: "`actions/bdd.md` — concrete examples and executable scenarios for the agreed behavior",
  },
  {
    skill: "uiux",
    step: "`actions/uiux.md` — UI/UX decisions, when the change has a user-facing surface",
  },
  {
    skill: "knowledge",
    step: "`actions/knowledge.md` — pass the knowledge gate before specifying, modeling, implementing, or reviewing, and capture every business rule learned",
  },
  {
    skill: "adr",
    step: "`actions/adr.md` — pass the ADR gate before designing or implementing, and record every architectural decision as an ADR",
  },
  { skill: "dev", step: "`actions/dev.md` — implementation, in TDD or direct mode" },
  { skill: "tdd", step: "`actions/tdd.md` — tests first, before each production change" },
  { skill: "review", step: "`actions/review.md` — incremental and final review" },
  {
    skill: "qa",
    step: "`actions/qa.md` — run every acceptance criterion and applicable edge case for real, with evidence",
  },
  {
    skill: "code-review",
    step: "`actions/code-review.md` — standards and spec review of the committed diff, from a fresh session",
  },
];

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function listTemplateFiles(directory: string): Promise<string[]> {
  const entries = await readdir(path.join(templateDirectory, directory), {
    withFileTypes: true,
  });

  const nestedFiles = await Promise.all(
    entries.map((entry) => {
      const relativePath = path.posix.join(directory, entry.name);

      return entry.isDirectory()
        ? listTemplateFiles(relativePath)
        : [relativePath];
    }),
  );

  return nestedFiles.flat().sort();
}

// Adds every group a selected group requires, keeping the catalog order.
function withRequiredSkills(selected: Skill[]): Skill[] {
  const values = new Set(selected.map((skill) => skill.value));
  const added: Skill[] = [];

  for (const skill of selected) {
    for (const required of skill.requires ?? []) {
      if (values.has(required)) continue;

      const requiredSkill = skills.find((candidate) => candidate.value === required);
      if (!requiredSkill) {
        throw new Error(`"${skill.value}" requires unknown group "${required}"`);
      }

      values.add(required);
      added.push(requiredSkill);
    }
  }

  for (const skill of added) {
    console.log(`  + ${skill.name} (required by the groups you selected)`);
  }

  return skills.filter((skill) => values.has(skill.value));
}

async function listSkillFiles(skill: Skill): Promise<string[]> {
  const directoryFiles = await Promise.all(
    (skill.directories ?? []).map(listTemplateFiles),
  );

  return [...skill.files, ...directoryFiles.flat()];
}

// With the Scrum team installed, its ceremonies decide when each workflow
// runs, so AGENTS.md points to them instead of listing the stage order.
function generateWorkflowSection(
  selectedValues: string[],
  stages: string[],
): string {
  if (selectedValues.includes("scrum")) {
    return `## Scrum Team

For a product request or a feature, work as the Scrum team in
\`scrum/README.md\`: read the board in \`docs/scrum/\`, run the ceremony it
calls for, and play one role at a time. The ceremonies decide when each
installed workflow runs, and the user approves the backlog and Sprint
Goal, new ADRs, the Sprint Review, and every commit or merge. End every
turn that returns to the user with the cycle handoff in
\`scrum/handoff.md\`. For a question or a small fix with no product
decision, use the workflows directly.

`;
  }

  if (stages.length <= 1) return "";

  return `## Workflow Order

Follow the installed stages in this order, then apply any other installed
instructions where the task needs them:

${stages.join("\n")}

`;
}

// The screenshot rule depends on whether the user opted into Playwright.
function generatePullRequestSection(usesPlaywright: boolean): string {
  const screenshots = usesPlaywright
    ? `This project uses Playwright for the browser. Map each "How to test it?"
step to a step of a Playwright test that opens the application, run it on
the base branch for "How it was" and on this branch for "How it is", and
put one screenshot per step in each table. If no Playwright config is in
the project yet, ask the user to approve setting it up
(\`npm init playwright@latest\`) before opening the pull request.`
    : `The user chose not to use Playwright. Do not install it. Take the "How it
was" and "How it is" screenshots only if your own tools can open the
application in a browser and capture it; otherwise delete those two
sections and say so in the pull request.`;

  return `## Pull Requests

Write every pull request description from
\`.github/pull_request_template.md\`. List the "How to test it?" steps as a
person would do them in the browser.

${screenshots}

`;
}

function generateAgentsMd(
  selectedSkills: Skill[],
  usesPlaywright: boolean,
): string {
  const sections = selectedSkills.map((skill) => {
    const links = skill.files
      .map((file) => `- \`${file}\``)
      .join("\n");

    return `### ${skill.name}\n\n${links}`;
  });

  const selectedValues = selectedSkills.map((skill) => skill.value);
  const stages = workflowStages
    .filter((stage) => selectedValues.includes(stage.skill))
    .map((stage, index) => `${index + 1}. ${stage.step}`);

  const workflowSection = generateWorkflowSection(selectedValues, stages);

  const adrSection = selectedValues.includes("adr")
    ? `## Architecture Decisions

Before designing or implementing anything, open the ADR gate,
\`docs/adr/README.md\`. State what the task is about to decide or touch,
then read only the ADRs the gate routes that to. Accepted ADRs are
binding. Every new architectural decision gets its own ADR and a gate
entry, following \`actions/adr.md\`.

`
    : "";

  const worktreeSection = selectedValues.includes("worktrees")
    ? `## Parallel Sessions

When you work in a git worktree, run \`node tools/worktree-slot.mjs\` before
starting the app. It gives the worktree its own slot and writes its ports
and database name to \`.worktree-slot.env\`; use those values instead of
the defaults, so sessions in other worktrees keep running. Create the
database it names with the project's own tool.

`
    : "";

  const pullRequestSection = (selectedValues.includes("pull-request")
    ? generatePullRequestSection(usesPlaywright)
    : "") + (selectedValues.includes("checks")
    ? `## Checks Before a Pull Request

Before opening a pull request, commit the work and run
\`node checks/checks.mjs\`. It runs the checks the diff reaches, listed in
\`checks/config.json\`, and stamps the commit when they pass; opening a pull
request from a commit with no stamp is refused. Fix what fails and run it
again. If the checks do not apply, \`node checks/checks.mjs --waive
"<reason>"\` and repeat the reason in the pull request body.

`
    : "");

  const knowledgeSection = selectedValues.includes("knowledge")
    ? `## Business Knowledge

Before specifying, modeling, implementing, or reviewing behavior, open the
knowledge gate, \`docs/knowledge/README.md\`. State the business subject of
the task, then read only the rules and research notes the gate routes it
to, and the glossary terms it uses. Confirmed rules are binding. Capture
every rule, term, and domain fact learned, following
\`actions/knowledge.md\`.

`
    : "";

  const harnessSection = selectedValues.includes("harness")
    ? `## Harness

For any change to production code or tests, follow \`actions/harness.md\`:
classify the request (feature, fix, or chore), declare the triggers it
hits (schema, permission, public contract, concurrency, new entity, cross
module), open a run in \`docs/harness/\`, and settle every pre-code stage of
its mode before writing code. \`harness/gate.mjs\` checks edits to guarded
paths against the run, warning (or blocking, when \`harness/config.json\`
says so) until it is ready; \`node harness/gate.mjs status\` shows what is
pending. Never edit \`docs/harness/active.json\` to get past the gate.

`
    : "";

  const reviewInstalled = selectedValues.some((value) => value === "review" || value === "code-review");
  const rulesSection = `## Project Rules

Each rule this project enforces lives once, as a row below (or in the
\`AGENTS.md\` of the folder it applies to). Docs explain a rule by linking
to its ID; they never restate it, because a rule written in two places
drifts. Add a row when a review catches the same mistake twice.

| ID | Rule | Applies to | Enforced by | Checkable | Why |
|---|---|---|---|---|---|

- **ID:** a prefix for the folder's level (\`ROOT\`, \`API\`, \`WEB\`) and two digits.
- **Applies to:** globs relative to this file's folder; empty means the whole folder.
- **Enforced by:** \`lint\`, \`test\`, \`hook\`, or \`review\`. A machine-enforced rule is not reviewed by hand.
- **Checkable:** yes, partial, or no. A "yes" enforced by review is a candidate for a lint rule or test.
- **Why:** one line, or a link to the doc that explains it.
${reviewInstalled ? "\nReviews run \`node tools/review-context.mjs\` to get the rules a diff reaches and cite them by ID.\n" : ""}
`;

  return `# AGENTS.md

## Purpose

This file is the entry point for AI coding agents working in this
repository.

Before starting a task, read the applicable instruction files below.
Use them to guide implementation, code reviews, testing, and planning.

## Installed Instructions

${sections.join("\n\n")}

${workflowSection}${harnessSection}${knowledgeSection}${adrSection}${pullRequestSection}${worktreeSection}${rulesSection}## Working Rules

1. Understand the existing codebase and architecture before making changes.
2. Read the relevant instruction files before starting a task.
3. Follow existing project conventions unless there is a clear reason to
   improve them.
4. Keep changes focused, cohesive, and as simple as possible.
5. Prioritize correctness, security, performance, and maintainability.
6. Avoid duplicated logic, unnecessary complexity, and speculative
   abstractions.
7. Add or update tests when appropriate.
8. Run relevant tests, type checks, and linting when available.
9. Never claim that a test or check passed unless it was actually run.
10. Explain what changed, what was verified, and what remains unresolved.

## Handling Conflicts

Follow system and developer instructions first, then applicable project
instructions. When instructions conflict, follow the higher-priority
instruction and preserve the project's established conventions where
possible.

## Completion Standard

A task is complete when the requested outcome is implemented, relevant
checks have been performed where possible, and any remaining limitations
are clearly communicated.
`;
}

async function readIncoming(
  file: string,
  generatedFiles: Map<string, string>,
): Promise<Buffer> {
  const generatedContent = generatedFiles.get(file);
  if (generatedContent !== undefined) return Buffer.from(generatedContent, "utf8");

  const source = path.join(templateDirectory, file);
  if (!(await exists(source))) {
    throw new Error(`Template not found: ${file}\nExpected location: ${source}`);
  }
  return readFile(source);
}

function printList(title: string, files: string[], mark: string): void {
  if (files.length === 0) return;
  console.log(`\n${title}`);
  for (const file of files) console.log(`  ${mark} ${file}`);
}

// Installs the files, using the lock to tell an untouched earlier install
// (updated without asking) from a file someone edited (asked about).
async function installFiles(
  filesToInstall: string[],
  generatedFiles: Map<string, string>,
  groups: string[],
): Promise<void> {
  const lock = await readLock(projectDirectory);
  const incoming = new Map<string, Buffer>();
  const states = new Map<string, ReturnType<typeof classify>>();

  for (const file of filesToInstall) {
    const content = await readIncoming(file, generatedFiles);
    incoming.set(file, content);
    states.set(
      file,
      classify(await hashFile(path.join(projectDirectory, file)), lock?.files[file], hashContent(content)),
    );
  }

  const conflicts = filesToInstall.filter((file) => states.get(file) === "modified");
  let overwriteAll = false;

  if (conflicts.length > 0) {
    console.log(
      lock
        ? "\nThese files changed since they were installed:\n"
        : "\nExisting files were found:\n",
    );

    for (const file of conflicts) {
      console.log(`  - ${file}`);
    }

    console.log(
      "\nOverwriting these files may replace existing project instructions.",
    );

    overwriteAll = await answer("--overwrite", options.overwrite ? true : undefined, () => false, () => confirm({
      message: "Overwrite all existing files listed above?",
      default: false,
    }));
  }

  const installed: string[] = [];
  const updated: string[] = [];
  const upToDate: string[] = [];
  const skipped: string[] = [];
  const lockedFiles: Record<string, string> = { ...(lock?.files ?? {}) };

  for (const file of filesToInstall) {
    const state = states.get(file);
    const content = incoming.get(file) as Buffer;

    if (state === "same") {
      upToDate.push(file);
      lockedFiles[file] = hashContent(content);
      continue;
    }
    if (state === "modified" && !overwriteAll) {
      skipped.push(file);
      continue;
    }

    const destination = path.join(projectDirectory, file);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, content);
    lockedFiles[file] = hashContent(content);
    (state === "new" ? installed : updated).push(file);
  }

  await writeLock(projectDirectory, { version: await packageVersion(), groups, files: lockedFiles });

  console.log("\nInstallation finished.");
  printList("Installed files:", installed, "✓");
  printList("Updated (unchanged since the last install, or overwritten as you chose):", updated, "↻");
  if (upToDate.length > 0) console.log(`\n${upToDate.length} file(s) already up to date.`);

  if (skipped.length > 0) {
    printList("Skipped to protect your changes:", skipped, "-");
    console.log(
      "\nReview these files and merge the instructions manually if needed.",
    );
  }

  console.log(
    `\nRecorded what was installed in .skills-code-kit/lock.json. Run \`npx skills-code-kit verify\` to see what changed since.`,
  );
  console.log("\nHappy coding!\n");
}

async function main(): Promise<void> {
  console.log("\n🧹 Clean Code Installer\n");

  console.log(`Target project: ${projectDirectory}\n`);

  if (options.groups) {
    const selectedSkills = withRequiredSkills(skills.filter((skill) => options.groups?.includes(skill.value)));
    return installSkills(selectedSkills);
  }

  if (options.yes) {
    throw new UsageError("With --yes, name the groups: --all or --groups a,b (see `npx skills-code-kit list`).");
  }

  const mode = await answer<string>("--all or --groups", undefined, () => "all", () => select({
    message: "What would you like to install?",
    choices: [
      {
        name: "Install everything",
        value: "all",
        description: "Install all instruction groups and templates",
      },
      {
        name: "Choose individual instruction groups",
        value: "selected",
        description: "Select only the instructions you need",
      },
    ],
  }));

  let selectedSkills: Skill[];

  if (mode === "all") {
    selectedSkills = skills;
  } else {
    const selectedValues = await checkbox({
      message: "Select the instruction groups to install:",
      choices: skills.map((skill) => ({
        name: skill.name,
        value: skill.value,
        description: skill.description,
      })),
      required: true,
    });

    selectedSkills = withRequiredSkills(
      skills.filter((skill) => selectedValues.includes(skill.value)),
    );
  }

  return installSkills(selectedSkills);
}

// The groups an earlier install put in this project: from the lock, or, for
// a lock written before groups were recorded, every group whose entry points
// are all in it.
async function installedGroups(): Promise<string[]> {
  const lock = await readLock(projectDirectory);
  if (!lock) return [];
  if (Array.isArray(lock.groups)) return lock.groups.filter((value) => skills.some((skill) => skill.value === value));
  return skills
    .filter((skill) => skill.files.every((file) => file in lock.files))
    .map((skill) => skill.value);
}

async function installSkills(selectedSkills: Skill[]): Promise<void> {
  if (selectedSkills.length === 0) {
    console.log("\nNo instruction groups selected. Installation cancelled.");
    return;
  }

  // AGENTS.md lists every installed group, not only this run's: a rerun with
  // fewer groups must not hide the others from the agents.
  const earlier = (await installedGroups()).filter(
    (value) => !selectedSkills.some((skill) => skill.value === value),
  );
  const listedSkills = skills.filter(
    (skill) => selectedSkills.includes(skill) || earlier.includes(skill.value),
  );
  if (earlier.length > 0) {
    console.log(`\nAGENTS.md keeps the groups installed earlier: ${earlier.join(", ")}`);
  }

  const usesPlaywright = listedSkills.some(
    (skill) => skill.value === "pull-request",
  )
    ? await choosePlaywright()
    : false;

  // AGENTS.md is always generated to provide an entry point to the
  // instruction files selected by the developer.
  const generatedFiles = new Map([
    ["AGENTS.md", generateAgentsMd(listedSkills, usesPlaywright)],
  ]);

  if (selectedSkills.some((skill) => skill.value === "scrum")) {
    for (const file of await generateScrumAgentFiles()) {
      generatedFiles.set(file.path, file.content);
    }
  }

  const skillFiles = await Promise.all(selectedSkills.map(listSkillFiles));
  const filesToInstall = [
    ...new Set([...skillFiles.flat(), ...generatedFiles.keys()]),
  ];

  console.log("\nThe following files will be installed:\n");

  for (const file of filesToInstall) {
    console.log(`  - ${file}`);
  }

  const proceed = await answer("--yes", options.groups ? true : undefined, () => true, () => confirm({
    message: "Continue with installation?",
    default: true,
  }));

  if (!proceed) {
    console.log("\nInstallation cancelled.");
    return;
  }

  await installFiles(filesToInstall, generatedFiles, listedSkills.map((skill) => skill.value));

  if (selectedSkills.some((skill) => skill.value === "harness")) {
    await offerHarnessHook();
  }

  if (selectedSkills.some((skill) => skill.value === "harness")) {
    await offerHarnessHelpers();
  }

  if (selectedSkills.some((skill) => skill.value === "writing-style")) {
    await useOutputStyle("Plain answers");
  }

  if (selectedSkills.some((skill) => skill.value === "checks")) {
    await offerChecksHook();
  }

  if (selectedSkills.some((skill) => skill.value === "worktrees")) {
    await offerWorktreeHook();
  }

  if (selectedSkills.some((skill) => skill.value === "guards")) {
    await offerGuardsHook();
  }

  await offerMcpServer();
}

async function packageVersion(): Promise<string> {
  const manifest = JSON.parse(
    await readFile(path.join(packageDirectory, "package.json"), "utf8"),
  ) as { version: string };
  return manifest.version;
}

// Optional: registers the kit's MCP server with the AI tools the user picks.
async function offerMcpServer(): Promise<void> {
  const install = await answer("--mcp", options.mcp ? options.mcp.length > 0 : undefined, () => false, () => confirm({
    message:
      "Also install the Skills Code Kit MCP server? It exposes the knowledge and ADR gates, rule capture, and harness runs as tools, and the installed workflows as prompts, to any MCP client.",
    default: false,
  }));

  if (!install) return;

  const detected = await detectMcpClients(projectDirectory);
  const selectedValues = await answer("--mcp", options.mcp, () => detected.map((client) => client.value), () => checkbox({
    message: "Register the MCP server with:",
    choices: mcpClients.map((client) => ({
      name: client.name,
      value: client.value,
      checked: detected.includes(client),
      description: `Writes ${client.configFile}`,
    })),
  }));

  const clients = mcpClients.filter((client) => selectedValues.includes(client.value));
  if (clients.length === 0) return;

  console.log("\nRegistering the MCP server:");
  await registerMcpServer(projectDirectory, clients, await packageVersion());
  console.log("\nRestart your AI tool to load it. Codex reads .codex/config.toml only in trusted projects.\n");
}

const harnessHookCommand = 'node "$CLAUDE_PROJECT_DIR"/harness/gate.mjs';
const guardsHookCommand = 'node "$CLAUDE_PROJECT_DIR"/guards/guard.mjs';
const briefHookCommand = 'node "$CLAUDE_PROJECT_DIR"/harness/gate.mjs brief';
const issueHookCommand = 'node "$CLAUDE_PROJECT_DIR"/harness/gate.mjs issue';
const checksHookCommand = 'node "$CLAUDE_PROJECT_DIR"/checks/checks.mjs hook';
// A session must start even outside git or before the config exists.
const worktreeHookCommand = 'node "$CLAUDE_PROJECT_DIR"/tools/worktree-slot.mjs --hook';

type HookEntry = { matcher?: string; hooks?: { type?: string; command?: string }[] };
type ClaudeSettings = { hooks?: Record<string, HookEntry[]> } & Record<string, unknown>;

// Adds a Claude Code PreToolUse hook, merged into any existing
// .claude/settings.json without touching its other settings.
async function addPreToolUseHook(command: string, matcher: string, name: string): Promise<void> {
  await addHook("PreToolUse", command, matcher, name);
}

async function addHook(event: string, command: string, matcher: string | undefined, name: string): Promise<void> {
  const settingsPath = path.join(projectDirectory, ".claude", "settings.json");
  let settings: ClaudeSettings = {};

  if (await exists(settingsPath)) {
    try {
      settings = JSON.parse(await readFile(settingsPath, "utf8")) as ClaudeSettings;
    } catch {
      console.log(
        `\n.claude/settings.json is not valid JSON, so it was left unchanged. Add this ${event} hook yourself${matcher ? ` (matcher "${matcher}")` : ""}: ${command}\n`,
      );
      return;
    }
  }

  const entries = settings.hooks?.[event] ?? [];
  const installed = entries.some((entry) =>
    entry.hooks?.some((hook) => hook.command === command),
  );

  if (installed) {
    console.log(`\nThe ${name} hook is already in .claude/settings.json.\n`);
    return;
  }

  settings.hooks = {
    ...settings.hooks,
    [event]: [...entries, { ...(matcher ? { matcher } : {}), hooks: [{ type: "command", command }] }],
  };

  await mkdir(path.dirname(settingsPath), { recursive: true });
  await writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  console.log(`\n✓ Added the ${name} hook to .claude/settings.json\n`);
}

// Sets "enforce" in the installed harness/config.json, keeping the rest.
async function setHarnessEnforcement(level: "warn" | "block"): Promise<void> {
  const configPath = path.join(projectDirectory, "harness", "config.json");
  try {
    const config = JSON.parse(await readFile(configPath, "utf8")) as Record<string, unknown>;
    if (config.enforce === level) return;
    config.enforce = level;
    await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  } catch {
    console.log(`\nCould not update harness/config.json; set "enforce": "${level}" in it yourself.`);
  }
}

// The harness gate warns by default: skipping a stage is recoverable, and a
// hook that blocks recoverable mistakes gets switched off.
async function offerHarnessHook(): Promise<void> {
  const choice = await answer<string>("--harness", options.harness, () => "warn", () => select({
    message: "How should the harness gate act in Claude Code when guarded code changes before the run is ready?",
    choices: [
      {
        name: "Warn (recommended)",
        value: "warn",
        description: "Tells the agent and you what is pending, once per session, and lets the edit through",
      },
      {
        name: "Block",
        value: "block",
        description: "Refuses the edit until every pre-code stage is settled",
      },
      {
        name: "No hook",
        value: "none",
        description: "Use node harness/gate.mjs check from a git hook or CI instead",
      },
    ],
  }));

  if (choice === "none") {
    console.log(
      "\nSkipped the hook. Run `node harness/gate.mjs check` from a git pre-commit hook or CI to check the harness instead.\n",
    );
    return;
  }

  await setHarnessEnforcement(choice as "warn" | "block");
  await addPreToolUseHook(harnessHookCommand, "Edit|Write|MultiEdit|NotebookEdit", "harness gate");
}

// Turns the installed output style on for the project, unless the project
// already chose another one.
async function useOutputStyle(name: string): Promise<void> {
  const settingsPath = path.join(projectDirectory, ".claude", "settings.json");
  let settings: ClaudeSettings = {};
  if (await exists(settingsPath)) {
    try {
      settings = JSON.parse(await readFile(settingsPath, "utf8")) as ClaudeSettings;
    } catch {
      console.log(`\n.claude/settings.json is not valid JSON; set "outputStyle": "${name}" in it yourself.\n`);
      return;
    }
  }
  if (settings.outputStyle === name) return;
  if (typeof settings.outputStyle === "string") {
    console.log(`\nThe project already uses the output style "${settings.outputStyle}"; switch to "${name}" with /output-style if you want it.\n`);
    return;
  }
  settings.outputStyle = name;
  await mkdir(path.dirname(settingsPath), { recursive: true });
  await writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  console.log(`\n✓ Set the output style to "${name}" in .claude/settings.json\n`);
}

// Two hooks that only inform: the run's state and next stage at each prompt,
// and the format of an issue saved through an issue tracker's MCP.
async function offerHarnessHelpers(): Promise<void> {
  const enable = await answer("--harness-helpers or --no-harness-helpers", options.harnessHelpers, () => true, () => confirm({
    message:
      "Brief the agent on the harness run at each prompt, and check the format of issues it saves through an issue tracker? Adds a UserPromptSubmit and a PreToolUse hook; neither blocks.",
    default: true,
  }));
  if (!enable) return;
  await addHook("UserPromptSubmit", briefHookCommand, undefined, "harness brief");
  await addPreToolUseHook(issueHookCommand, "mcp__.*__(save_issue|create_issue|update_issue)", "issue format");
}

// Refusing a pull request is the one block outside the guards: an opened
// pull request notifies reviewers and runs CI, and the way past it, a waiver
// with its reason, is one command.
async function offerChecksHook(): Promise<void> {
  const enable = await answer("--checks or --no-checks", options.checks, () => true, () => confirm({
    message:
      "Refuse to open a pull request from a commit the checks have not passed? Adds a PreToolUse hook to .claude/settings.json.",
    default: true,
  }));

  if (!enable) {
    console.log("\nSkipped the checks hook. Run `node checks/checks.mjs` from a git pre-push hook instead.\n");
    return;
  }

  await addPreToolUseHook(checksHookCommand, "Bash|mcp__.*create_pull_request", "checks");
  console.log('List the commands that prove a change in checks/config.json "checks" ("when" limits one to the paths it covers). To run them on every push too, add `node checks/checks.mjs` to your git pre-push hook.\n');
}

async function offerWorktreeHook(): Promise<void> {
  const enable = await answer("--worktree-hook or --no-worktree-hook", options.worktreeHook, () => true, () => confirm({
    message:
      "Assign the worktree slot (ports and database name) when a Claude Code session starts? Adds a SessionStart hook to .claude/settings.json.",
    default: true,
  }));

  if (!enable) return;
  await addHook("SessionStart", worktreeHookCommand, undefined, "worktree slot");
}

async function offerGuardsHook(): Promise<void> {
  const enable = await answer("--guards or --no-guards", options.guards, () => true, () => confirm({
    message:
      "Turn the guards on in Claude Code? Adds a PreToolUse hook to .claude/settings.json that blocks secrets, protected files, destructive commands, and commits to protected branches.",
    default: true,
  }));

  if (!enable) {
    console.log("\nSkipped the guards hook. guards/guard.mjs reads the same hook JSON if you wire it into another tool.\n");
    return;
  }

  await addPreToolUseHook(guardsHookCommand, "Bash|Read|Edit|Write|MultiEdit|NotebookEdit", "guards");
  console.log(
    'List the folders your tools must own (migrations, generated code) in guards/config.json "protectedPaths", the branches nobody commits to directly in "protectedBranches", and the words that name your production cloud targets (a project, profile, or context such as "prod") in "production.markers".\n',
  );
}

// Pull request screenshots come from Playwright. The user opts in; when the
// project has no Playwright config yet, they are told how to add it.
async function choosePlaywright(): Promise<boolean> {
  const configChecks = playwrightConfigs.map((file) =>
    exists(path.join(projectDirectory, file)),
  );
  const configured = (await Promise.all(configChecks)).some(Boolean);

  const usesPlaywright = await answer("--playwright or --no-playwright", options.playwright, () => configured, () => confirm({
    message: configured
      ? "Playwright is configured. Use it for pull request test steps and screenshots?"
      : "Use Playwright for pull request test steps and screenshots? (it is not configured yet)",
    default: true,
  }));

  if (usesPlaywright && !configured) {
    console.log(
      "\nConfigure Playwright in this project before the first pull request:\n\n  npm init playwright@latest\n\nThen set use.baseURL (and webServer) in playwright.config to open your application.",
    );
  }

  if (!usesPlaywright) {
    console.log(
      "\nPull requests will skip the before and after screenshots, unless the AI tool can take them without Playwright.",
    );
  }

  return usesPlaywright;
}

// Asks which AI tools get native Scrum role agents, preselecting the tools
// found in the project.
async function chooseAgentTools(): Promise<AgentTool[]> {
  const detected = await detectAgentTools(projectDirectory);

  console.log(
    detected.length > 0
      ? `\nAI tools found in this project: ${detected.map((tool) => tool.name).join(", ")}`
      : "\nNo AI tool configuration found in this project.",
  );

  const selectedValues = await answer("--agents", options.agents, () => detected.map((tool) => tool.value), () => checkbox({
    message: "Install the Scrum role agents for:",
    choices: agentTools.map((tool) => ({
      name: tool.name,
      value: tool.value,
      checked: detected.includes(tool),
      description: `Detected by ${tool.markers.join(", ")}`,
    })),
  }));

  return agentTools.filter((tool) => selectedValues.includes(tool.value));
}

// Claude Code reads CLAUDE.md, not AGENTS.md, so it gets a CLAUDE.md that
// imports AGENTS.md. An existing CLAUDE.md is never replaced.
async function claudeEntryPoint(): Promise<{ path: string; content: string }[]> {
  const claudeMd = path.join(projectDirectory, "CLAUDE.md");

  if (!(await exists(claudeMd))) {
    return [{ path: "CLAUDE.md", content: "@AGENTS.md\n" }];
  }

  if (!(await readFile(claudeMd, "utf8")).includes("AGENTS.md")) {
    console.log(
      "\nYour CLAUDE.md does not mention AGENTS.md. Add the line @AGENTS.md to it so Claude Code reads the installed instructions.",
    );
  }

  return [];
}

async function generateScrumAgentFiles(): Promise<
  { path: string; content: string }[]
> {
  const tools = await chooseAgentTools();
  const files = generateAgentFiles(tools);

  if (tools.some((tool) => tool.value === "claude")) {
    files.push(...(await claudeEntryPoint()));
  }

  return files;
}

// `skills-code-kit verify` reports installed files that were edited, deleted,
// or have a newer template, using .skills-code-kit/lock.json.
async function runVerify(): Promise<number> {
  const report = await verifyProject(projectDirectory, templateDirectory);

  if (!report) {
    console.log("No .skills-code-kit/lock.json here. Run `npx skills-code-kit` to install and record the files.");
    return 1;
  }

  const section = (title: string, files: string[]) => {
    if (files.length === 0) return;
    console.log(`\n${title}`);
    for (const file of files) console.log(`  - ${file}`);
  };

  console.log(`Checked ${report.checked} installed file(s) against .skills-code-kit/lock.json.`);
  section("Changed since installed:", report.modified);
  section("Deleted since installed:", report.missing);
  section(`Newer template in skills-code-kit ${await packageVersion()}:`, report.outdated);

  if (report.modified.length + report.missing.length + report.outdated.length === 0) {
    console.log("Everything matches what was installed.");
  }
  return report.modified.length + report.missing.length > 0 ? 1 : 0;
}

// `skills-code-kit mcp` serves the MCP server over stdio instead of
// installing; stdout then belongs to the protocol, so nothing else prints.
async function run(): Promise<void> {
  const argv = process.argv.slice(2);
  const command = argv[0] && !argv[0].startsWith("-") ? argv[0] : "install";
  const args = argv[0] === command ? argv.slice(1) : argv;

  if (command === "help" || args.includes("--help") || args.includes("-h")) {
    console.log(usage);
    return;
  }

  if (command === "version" || args.includes("--version") || args.includes("-v")) {
    console.log(await packageVersion());
    return;
  }

  if (command === "list") {
    printGroups();
    return;
  }

  if (command === "verify") {
    process.exitCode = await runVerify();
    return;
  }

  if (command === "mcp") {
    const { startMcpServer } = await import("./mcp.js");
    await startMcpServer(args, await packageVersion());
    return;
  }

  if (command !== "install") {
    throw new UsageError(`Unknown command "${command}".`);
  }

  options = parseInstallOptions(args);
  await main();
}

function printGroups(): void {
  const width = Math.max(...skills.map((skill) => skill.value.length));
  for (const skill of skills) {
    const requires = skill.requires?.length ? ` (also installs ${skill.requires.join(", ")})` : "";
    console.log(`${skill.value.padEnd(width)}  ${skill.description}${requires}`);
  }
}

run().catch((error: unknown) => {
  if (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "ExitPromptError"
  ) {
    console.log("\nInstallation cancelled.");
    process.exitCode = 0;
    return;
  }

  if (error instanceof UsageError || (error instanceof Error && "code" in error && String(error.code).startsWith("ERR_PARSE_ARGS"))) {
    console.error(`${error.message}\n\nRun \`npx skills-code-kit --help\` for the commands and options.`);
    process.exitCode = 2;
    return;
  }

  const message =
    error instanceof Error ? error.message : String(error);

  console.error("\nInstallation failed:", message);
  process.exitCode = 1;
});
