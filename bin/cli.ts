#!/usr/bin/env node

import { checkbox, confirm, select } from "@inquirer/prompts";
import {
  access,
  copyFile,
  mkdir,
  readdir,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type Skill = {
  value: string;
  name: string;
  description: string;
  // Entry points listed in the generated AGENTS.md.
  files: string[];
  // Template directories installed in full, alongside the entry points.
  directories?: string[];
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
];

// Delivery stages in the order an agent should follow them.
const workflowStages: { skill: string; step: string }[] = [
  {
    skill: "product",
    step: "`ProductDefinition/plan.md`, then `ProductDefinition/specs/spec-definition.md`, then `ProductDefinition/specs/spec-checklist.md`",
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
  { skill: "dev", step: "`actions/dev.md` — implementation, in TDD or direct mode" },
  { skill: "tdd", step: "`actions/tdd.md` — tests first, before each production change" },
  { skill: "review", step: "`actions/review.md` — incremental and final review" },
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

async function listSkillFiles(skill: Skill): Promise<string[]> {
  const directoryFiles = await Promise.all(
    (skill.directories ?? []).map(listTemplateFiles),
  );

  return [...skill.files, ...directoryFiles.flat()];
}

function generateAgentsMd(selectedSkills: Skill[]): string {
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

  const workflowSection =
    stages.length > 1
      ? `## Workflow Order

Follow the installed stages in this order, then apply any other installed
instructions where the task needs them:

${stages.join("\n")}

`
      : "";

  return `# AGENTS.md

## Purpose

This file is the entry point for AI coding agents working in this
repository.

Before starting a task, read the applicable instruction files below.
Use them to guide implementation, code reviews, testing, and planning.

## Installed Instructions

${sections.join("\n\n")}

${workflowSection}## Working Rules

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
  selectedSkills: Skill[],
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

    if (file === "AGENTS.md") {
      await writeFile(
        destination,
        generateAgentsMd(selectedSkills),
        "utf8",
      );
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

    selectedSkills = skills.filter((skill) =>
      selectedValues.includes(skill.value),
    );
  }

  if (selectedSkills.length === 0) {
    console.log("\nNo instruction groups selected. Installation cancelled.");
    return;
  }

  // AGENTS.md is always generated to provide an entry point to the
  // instruction files selected by the developer.
  const skillFiles = await Promise.all(selectedSkills.map(listSkillFiles));
  const filesToInstall = [...new Set([...skillFiles.flat(), "AGENTS.md"])];

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

  await installFiles(filesToInstall, selectedSkills);
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
