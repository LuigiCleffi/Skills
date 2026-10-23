#!/usr/bin/env node

import { checkbox, confirm, select } from "@inquirer/prompts";
import {
  access,
  copyFile,
  mkdir,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type Skill = {
  value: string;
  name: string;
  description: string;
  files: string[];
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
    files: ["CleanCode_Uncle_Bob/README.md"],
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
    description: "Testing workflow and TDD principles",
    files: ["actions/tdd.md"],
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
];

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function generateAgentsMd(selectedSkills: Skill[]): string {
  const sections = selectedSkills.map((skill) => {
    const links = skill.files
      .map((file) => `- \`${file}\``)
      .join("\n");

    return `### ${skill.name}\n\n${links}`;
  });

  return `# AGENTS.md

## Purpose

This file is the entry point for AI coding agents working in this
repository.

Before starting a task, read the applicable instruction files below.
Use them to guide implementation, code reviews, testing, and planning.

## Installed Instructions

${sections.join("\n\n")}

## Working Rules

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
  const filesToInstall = [
    ...new Set([
      ...selectedSkills.flatMap((skill) => skill.files),
      "AGENTS.md",
    ]),
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
