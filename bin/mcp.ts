// The Skills Code Kit MCP server: the gates, rule capture, and harness runs
// as tools, the installed workflows as prompts, and the gates as resources,
// for any MCP client. Started with `skills-code-kit mcp [--project <dir>]`.

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { consultGate, gateFiles } from "./gates.js";
import { closeRun, harnessStatus, openRun, setStage } from "./harnessRuns.js";
import { captureRule } from "./rules.js";

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

function text(value: string): ToolResult {
  return { content: [{ type: "text", text: value }] };
}

// Turns a thrown error into a tool error the agent can read and act on.
async function respond(work: () => Promise<string>): Promise<ToolResult> {
  try {
    return text(await work());
  } catch (error) {
    return { ...text(error instanceof Error ? error.message : String(error)), isError: true };
  }
}

function projectFromArgs(args: string[]): string {
  const flag = args.indexOf("--project");
  const value = flag === -1 ? undefined : args[flag + 1];
  return path.resolve(value ?? process.env.SKILLS_CODE_KIT_PROJECT ?? process.cwd());
}

async function readIfExists(file: string): Promise<string | null> {
  try {
    return await readFile(file, "utf8");
  } catch {
    return null;
  }
}

function frontmatterDescription(document: string): string | undefined {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(document)?.[1] ?? "";
  const line = /^description:\s*(.+)$/m.exec(frontmatter)?.[1]?.trim();
  if (!line) return undefined;
  return line.startsWith('"') ? (JSON.parse(line) as string) : line;
}

function registerGateTools(server: McpServer, project: string): void {
  const gateInput = {
    about: z
      .string()
      .min(3)
      .describe("What the task is about or about to decide, in task words (\"add a refund endpoint for marketplace orders\")"),
    paths: z.array(z.string()).default([]).describe("Files or folders the task expects to change, relative to the project"),
  };

  server.registerTool(
    "knowledge_gate",
    {
      title: "Knowledge gate",
      description:
        "Consult the business knowledge gate (docs/knowledge/README.md) before specifying, modeling, implementing, or reviewing behavior. Returns the matching routing rows, the business rules and research notes they point to, and the glossary terms the task uses. Confirmed rules are binding; Proposed rules are questions for the user.",
      inputSchema: gateInput,
    },
    ({ about, paths }) => respond(() => consultGate(project, "knowledge", about, paths)),
  );

  server.registerTool(
    "adr_gate",
    {
      title: "ADR gate",
      description:
        "Consult the ADR gate (docs/adr/README.md) before designing or implementing. Returns the matching routing rows and the architecture decision records they point to. Accepted ADRs are binding.",
      inputSchema: gateInput,
    },
    ({ about, paths }) => respond(() => consultGate(project, "adr", about, paths)),
  );

  server.registerTool(
    "capture_rule",
    {
      title: "Capture a business rule",
      description:
        "Record one business rule as docs/knowledge/rules/BR-NNNN-*.md and add its routing and register rows to the knowledge gate, following actions/knowledge.md. Use status Confirmed only when a decider (the user or someone they named) confirmed it; rules from code or research are Proposed.",
      inputSchema: {
        statement: z.string().min(5).describe("The rule as one plain sentence"),
        details: z.string().optional().describe("The precise statement: conditions, values, units, time zones, rounding"),
        context: z.string().describe("The bounded context, from the glossary"),
        source: z.string().describe("Where it came from: \"the user on 2026-11-12\", \"spec FR-07\", \"RS-0001\", \"harvested from src/x.ts:42 (unconfirmed)\""),
        status: z.enum(["Proposed", "Confirmed"]),
        confirmedBy: z.string().optional().describe("Required when status is Confirmed"),
        examples: z
          .array(z.object({ situation: z.string(), outcome: z.string() }))
          .min(1)
          .describe("At least one example, including the boundary case"),
        rationale: z.string().optional(),
        subject: z.string().describe("The business subject for the gate's About column, e.g. \"Refunds, returns, chargebacks\""),
        keywords: z.array(z.string()).min(1),
        paths: z.array(z.string()).default([]).describe("Code globs where the rule applies, e.g. src/billing/**"),
      },
    },
    (rule) => respond(async () => `Captured ${await captureRule(project, rule)} and updated the knowledge gate.`),
  );
}

function registerHarnessTools(server: McpServer, project: string): void {
  server.registerTool(
    "harness_status",
    {
      title: "Harness status",
      description: "Show the active harness run and which stages still block guarded code.",
      inputSchema: {},
    },
    () => respond(() => harnessStatus(project)),
  );

  server.registerTool(
    "harness_open_run",
    {
      title: "Open a harness run",
      description:
        "Open a run for a request that will change guarded code, following actions/harness.md. Creates docs/harness/runs/<date>-<slug>.md and docs/harness/active.json with every stage of the mode pending.",
      inputSchema: {
        request: z.string().describe("The request in one line"),
        mode: z.string().describe("feature, fix, or chore (or a mode defined in harness/config.json)"),
        reason: z.string().describe("Why this mode"),
        slug: z.string().describe("Short kebab-case name for the run file"),
      },
    },
    (input) => respond(() => openRun(project, input)),
  );

  server.registerTool(
    "harness_set_stage",
    {
      title: "Settle a harness stage",
      description:
        "Record a stage of the active run as done (with the record it produced), skipped or n/a (with a reason), or back to pending. Refuses done when the record file does not exist and skipped without a reason. Mark a stage done only when its workflow's completion criteria are met.",
      inputSchema: {
        stage: z.string(),
        status: z.enum(["pending", "done", "skipped", "n/a"]),
        reason: z.string().optional().describe("Required for skipped and n/a; a note for done"),
        record: z.string().optional().describe("Path of the record the stage produced, relative to the project"),
      },
    },
    (input) => respond(() => setStage(project, input)),
  );

  server.registerTool(
    "harness_close_run",
    {
      title: "Close a harness run",
      description:
        "Close the active run with its result (Closed requires every stage settled), or abandon it. Writes the result into the run record and removes docs/harness/active.json.",
      inputSchema: {
        status: z.enum(["Closed", "Abandoned"]),
        result: z.string().describe("What changed, checks run and their results, review findings, what remains; or why it was abandoned"),
      },
    },
    (input) => respond(() => closeRun(project, input)),
  );
}

// One prompt per installed workflow in actions/, so any client can start it.
async function registerWorkflowPrompts(server: McpServer, project: string): Promise<void> {
  const actionsDirectory = path.join(project, "actions");
  const files = await readdir(actionsDirectory).catch(() => [] as string[]);

  for (const file of files.filter((name) => name.endsWith(".md")).sort()) {
    const name = path.basename(file, ".md");
    const relative = `actions/${file}`;
    const document = await readFile(path.join(actionsDirectory, file), "utf8");

    server.registerPrompt(
      name,
      {
        title: `Workflow: ${name}`,
        description: frontmatterDescription(document) ?? `Follow ${relative}.`,
        argsSchema: { task: z.string().optional().describe("The task to run this workflow for") },
      },
      async ({ task }) => ({
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Follow the workflow in \`${relative}\`${task ? ` for this task: ${task}` : ""}.\n\n${await readFile(path.join(actionsDirectory, file), "utf8")}`,
            },
          },
        ],
      }),
    );
  }
}

function registerGateResources(server: McpServer, project: string): void {
  const resources = [
    { name: "agents", file: "AGENTS.md", title: "AGENTS.md entry point" },
    { name: "knowledge-gate", file: gateFiles.knowledge, title: "Knowledge gate" },
    { name: "adr-gate", file: gateFiles.adr, title: "ADR gate" },
    { name: "glossary", file: "docs/knowledge/glossary.md", title: "Glossary" },
  ];

  for (const resource of resources) {
    const uri = `skills-code-kit://project/${resource.file}`;

    server.registerResource(
      resource.name,
      uri,
      { title: resource.title, mimeType: "text/markdown" },
      async () => ({
        contents: [
          {
            uri,
            text: (await readIfExists(path.join(project, resource.file))) ?? `${resource.file} does not exist yet.`,
          },
        ],
      }),
    );
  }
}

export async function startMcpServer(args: string[], version: string): Promise<void> {
  const project = projectFromArgs(args);
  const server = new McpServer({ name: "skills-code-kit", version });

  registerGateTools(server, project);
  registerHarnessTools(server, project);
  registerGateResources(server, project);
  await registerWorkflowPrompts(server, project);

  await server.connect(new StdioServerTransport());
}
