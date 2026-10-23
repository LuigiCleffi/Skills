# Skills Code Kit

Reusable instructions for AI coding agents to help developers build software that is clear, correct, maintainable, and aligned with product requirements.

**Skills Code Kit** provides focused instruction sets for Clean Code, development workflows, code reviews, test-driven development (TDD), and product definition. Install the instructions you need directly into an existing project without cloning this repository.

## Why Skills Code Kit?

AI coding tools can generate code quickly, but speed alone does not guarantee quality.

These instructions establish shared engineering standards for how an AI agent should understand an existing codebase, make changes, review implementations, test behavior, and connect technical decisions to product requirements.

The goal is not to enforce style for its own sake. It is to make code easier to understand and change while protecting correctness, security, performance, and maintainability.

## Installation

**Requirements:** Node.js 20 or newer and npm.

Navigate to the root of the project where you want to install the instructions, then run:

```bash
npx skills-code-kit
```

The interactive installer lets you choose between installing everything and selecting individual instruction groups.

Review the files to be installed and confirm before proceeding.

> Run the command from your target project's root directory. The installer writes the selected instructions into the current working directory.

## Available instruction groups

### 1. Clean Code Standards

**Purpose:** Establish principles for writing elegant, readable, cohesive, and maintainable code.

This instruction set guides AI agents to:

- Choose names that reveal intent and meaningful purpose.
- Keep functions, classes, and modules focused on a clear responsibility.
- Avoid unnecessary complexity, duplication, and repetitive logic.
- Handle errors and edge cases carefully.
- Consider correctness, security, performance, and resource management.
- Avoid introducing messy code that makes future changes harder.

**Installed files:**

`CleanCode/` — the `README.md` entry point plus every Clean Code skill folder it routes to.

### 2. Development Workflow

**Purpose:** Guide implementation of features, bug fixes, and other code changes.

This instruction set helps AI agents:

- Understand the existing architecture before making changes.
- Follow established project conventions.
- Identify the appropriate implementation approach.
- Keep changes focused and cohesive.
- Verify behavior through relevant tests and checks.
- Communicate what changed and what remains unresolved.

**Installed file:**

`actions/dev.md`

### 3. Code Review

**Purpose:** Evaluate code changes systematically rather than relying on whether the code merely looks correct.

The review workflow focuses on:

- Functional correctness and regressions.
- Security vulnerabilities and unsafe assumptions.
- Edge cases and error handling.
- Duplicated logic and unnecessary complexity.
- Missing or inadequate tests.
- Maintainability and consistency with the existing architecture.

**Installed file:**

`actions/review.md`

### 4. Test-Driven Development (TDD)

**Purpose:** Encourage implementation guided by observable, testable behavior.

The TDD instructions help AI agents:

- Define expected behavior before implementation.
- Use tests to clarify requirements.
- Implement the smallest change that satisfies the expected behavior.
- Refactor while preserving correctness.
- Verify that relevant tests pass.

It also installs a test pattern library: one skill per chapter of Kent Beck's *Test-Driven Development: By Example*, routed from `TDD/README.md`. The pattern skills cover choosing the next test (Test List, Starter Test, One Step Test), writing it (Assert First, Evident Data, Mock Object, Self Shunt, Log String), getting to green (Fake It, Triangulate, Obvious Implementation), xUnit mechanics, the design patterns and refactorings TDD relies on, and step size and test quality. The worked money and xUnit examples show those moves in a real session.

**Installed files:**

- `actions/tdd.md`
- `TDD/` — the `README.md` entry point plus one skill folder per chapter, grouped into `MoneyExample/`, `XUnitExample/` and `Patterns/`.

### 5. Product Definition

**Purpose:** Clarify what should be built and how success should be evaluated before implementation begins.

This group includes planning and specification documents to help define:

- Product goals and scope.
- Functional requirements and constraints.
- Acceptance criteria.
- Specification completeness and readiness.
- The relationship between product expectations and implementation work.

**Installed files:**

- `ProductDefinition/plan.md`
- `ProductDefinition/specs/spec-definition.md`
- `ProductDefinition/specs/spec-checklist.md`

## How installation works

1. Run `npx skills-code-kit` in your project.
2. Choose **Install everything** or select individual instruction groups.
3. Review the list of files the installer plans to create.
4. Confirm the installation.
5. Start using the installed instructions with your AI coding agent.

The installer copies instruction templates into your project and generates an `AGENTS.md` file that acts as an entry point for the selected instructions.

No repository clone is required.

## The role of `AGENTS.md`

`AGENTS.md` provides the AI agent with an entry point to the installed instructions.

It identifies the relevant instruction files and establishes working expectations, including:

- Understand the codebase before modifying it.
- Read the applicable instructions before starting a task.
- Prioritize correctness, security, simplicity, and maintainability.
- Run relevant tests and checks when possible.
- Report completed changes and verification results honestly.

The generated file references the instruction groups selected during installation.

AI tools vary in how they discover and interpret instruction files. Check your tool's documentation if additional configuration is required.

## Existing files and conflicts

The installer checks for existing destination files before writing.

If conflicts are found, it asks whether you want to overwrite the listed files.

- **Confirm overwrite:** Existing files in the conflict list may be replaced.
- **Decline overwrite:** Existing files are skipped to protect your current content.
- **Manual merge:** Skipped files are not merged automatically; review and combine the content yourself when needed.

**Important:** If your project already contains a custom `AGENTS.md`, review the conflict list carefully before approving an overwrite.

## Updating the instructions

To run the latest published version:

```bash
npx skills-code-kit@latest
```

The installer may encounter files from a previous installation. Review its conflict prompts before proceeding so you do not accidentally replace project-specific instructions.

## Repository structure

The repository separates its working instruction documents from the templates distributed through npm.

```text
.
├── AGENTS.md
├── CleanCode_Uncle_Bob/
│   └── README.md
├── ProductDefinition/
│   ├── plan.md
│   └── specs/
│       ├── spec-checklist.md
│       └── spec-definition.md
├── actions/
│   ├── dev.md
│   └── review.md
├── bin/
│   └── cli.ts
├── dist/
│   └── cli.js
├── templates/
│   ├── CleanCode/
│   ├── ProductDefinition/
│   ├── TDD/
│   └── actions/
├── package.json
└── tsconfig.json
```

| Location | Responsibility |
|---|---|
| `bin/cli.ts` | TypeScript source code for the installer. |
| `dist/cli.js` | Compiled executable invoked by npm. |
| `templates/` | Instruction files distributed to users. |
| `templates/TDD/` | TDD test pattern library, one skill per chapter of Kent Beck's book. |
| `CleanCode_Uncle_Bob/` | Working copy of the core Clean Code standards. |
| `ProductDefinition/` | Planning and specification documents. |
| `actions/` | Development, review, and TDD workflows. |
| `AGENTS.md` | Repository-level entry point for AI coding instructions. |

Keep the distributed templates synchronized with their corresponding working copies whenever you update an instruction.

## Contributing and publishing

When changing the instructions distributed through npm, update the corresponding files under `templates/` as well.

Publish with the release script. It checks your npm login, bumps the version when the current one is already on npm, installs dependencies, builds, checks the package contents, and publishes:

```bash
npm run release
```

Pass `minor` or `major` instead of the default patch bump, or `--dry-run` to run every check without changing the version or publishing:

```bash
npm run release -- minor
npm run release -- --dry-run
```

Use a patch version for fixes, a minor version for backward-compatible features, and a major version for breaking changes. The script does not commit; commit and tag the version change after publishing.

## Guiding principle

Generate code quickly, but judge it by the quality of the result.

Code should communicate intent clearly, solve the right problem, handle failure thoughtfully, and remain understandable and maintainable long after its initial implementation.