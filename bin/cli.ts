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
import {
  type AgentTool,
  agentTools,
  detectAgentTools,
  generateAgentFiles,
} from "./agents.js";

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
    files: ["actions/review.md"],
  },
  {
    value: "code-review",
    name: "Standards and spec code review",
    description: "Two-axis review of a committed diff against repo standards, the knowledge base, and the spec",
    files: ["actions/code-review.md"],
  },
  {
    value: "adr",
    name: "Architecture decision records",
    description: "One ADR per architectural decision, plus the gate that routes each task to the ADRs that govern it",
    files: ["actions/adr.md"],
  },
  {
    value: "tdd",
    name: "Test-driven development",
    description: "Testing workflow and the TDD test pattern library",
    files: ["actions/tdd.md", "TDD/README.md"],
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
    files: ["actions/bdd.md", "BDD/README.md"],
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
    name: "Pull request template",
    description: "What was implemented, why, human test steps, and before and after screenshots taken with Playwright",
    files: [".github/pull_request_template.md"],
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
  {
    skill: "product",
    step: "`ProductDefinition/plan.md`, then `ProductDefinition/specs/spec-definition.md`, then `ProductDefinition/specs/spec-checklist.md`",
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
    skill: "adr",
    step: "`actions/adr.md` — pass the ADR gate before designing or implementing, and record every architectural decision as an ADR",
  },
  { skill: "dev", step: "`actions/dev.md` — implementation, in TDD or direct mode" },
  { skill: "tdd", step: "`actions/tdd.md` — tests first, before each production change" },
  { skill: "review", step: "`actions/review.md` — incremental and final review" },
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

  const pullRequestSection = selectedValues.includes("pull-request")
    ? generatePullRequestSection(usesPlaywright)
    : "";

  return `# AGENTS.md

## Purpose

This file is the entry point for AI coding agents working in this
repository.

Before starting a task, read the applicable instruction files below.
Use them to guide implementation, code reviews, testing, and planning.

## Installed Instructions

${sections.join("\n\n")}

${workflowSection}${adrSection}${pullRequestSection}## Working Rules

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

async function installFiles(
  filesToInstall: string[],
  generatedFiles: Map<string, string>,
): Promise<void> {
  const conflicts: string[] = [];

  for (const file of filesToInstall) {
    const destination = path.join(projectDirectory, file);

    if (await exists(destination)) {
      conflicts.push(file);
    }
  }

  let overwriteAll = false;

  if (conflicts.length > 0) {
    console.log("\nExisting files were found:\n");

    for (const file of conflicts) {
      console.log(`  - ${file}`);
    }

    console.log(
      "\nOverwriting these files may replace existing project instructions.",
    );

    overwriteAll = await confirm({
      message: "Overwrite all existing files listed above?",
      default: false,
    });
  }

  const installed: string[] = [];
  const skipped: string[] = [];

  for (const file of filesToInstall) {
    const destination = path.join(projectDirectory, file);
    const destinationExists = await exists(destination);

    if (destinationExists && !overwriteAll) {
      skipped.push(file);
      continue;
    }

    await mkdir(path.dirname(destination), { recursive: true });

    const generatedContent = generatedFiles.get(file);

    if (generatedContent !== undefined) {
      await writeFile(destination, generatedContent, "utf8");
    } else {
      const source = path.join(templateDirectory, file);

      if (!(await exists(source))) {
        throw new Error(
          `Template not found: ${file}\nExpected location: ${source}`,
        );
      }

      await copyFile(source, destination);
    }

    installed.push(file);
  }

  console.log("\nInstallation finished.\n");

  if (installed.length > 0) {
    console.log("Installed files:");

    for (const file of installed) {
      console.log(`  ✓ ${file}`);
    }
  }

  if (skipped.length > 0) {
    console.log("\nSkipped to protect existing files:");

    for (const file of skipped) {
      console.log(`  - ${file}`);
    }

    console.log(
      "\nReview these files and merge the instructions manually if needed.",
    );
  }

  console.log("\nHappy coding!\n");
}

async function main(): Promise<void> {
  console.log("\n🧹 Clean Code Installer\n");

  console.log(`Target project: ${projectDirectory}\n`);

  const mode = await select({
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
  });

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

  if (selectedSkills.length === 0) {
    console.log("\nNo instruction groups selected. Installation cancelled.");
    return;
  }

  const usesPlaywright = selectedSkills.some(
    (skill) => skill.value === "pull-request",
  )
    ? await choosePlaywright()
    : false;

  // AGENTS.md is always generated to provide an entry point to the
  // instruction files selected by the developer.
  const generatedFiles = new Map([
    ["AGENTS.md", generateAgentsMd(selectedSkills, usesPlaywright)],
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

  const proceed = await confirm({
    message: "Continue with installation?",
    default: true,
  });

  if (!proceed) {
    console.log("\nInstallation cancelled.");
    return;
  }

  await installFiles(filesToInstall, generatedFiles);
}

// Pull request screenshots come from Playwright. The user opts in; when the
// project has no Playwright config yet, they are told how to add it.
async function choosePlaywright(): Promise<boolean> {
  const configChecks = playwrightConfigs.map((file) =>
    exists(path.join(projectDirectory, file)),
  );
  const configured = (await Promise.all(configChecks)).some(Boolean);

  const usesPlaywright = await confirm({
    message: configured
      ? "Playwright is configured. Use it for pull request test steps and screenshots?"
      : "Use Playwright for pull request test steps and screenshots? (it is not configured yet)",
    default: true,
  });

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

  const selectedValues = await checkbox({
    message: "Install the Scrum role agents for:",
    choices: agentTools.map((tool) => ({
      name: tool.name,
      value: tool.value,
      checked: detected.includes(tool),
      description: `Detected by ${tool.markers.join(", ")}`,
    })),
  });

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

main().catch((error: unknown) => {
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

  const message =
    error instanceof Error ? error.message : String(error);

  console.error("\nInstallation failed:", message);
  process.exitCode = 1;
});
