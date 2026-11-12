// Harness runs as actions/harness.md describes them: open a run, settle its
// stages, close it. Readiness rules come from the project's own
// harness/gate.mjs, so the MCP tools and the hook can never disagree.

import { existsSync } from "node:fs";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

type HarnessConfig = { modes?: Record<string, string[]>; state?: string };
type RunEvaluation = { ready: boolean; summary: string; problems: string[] };

type Gate = {
  loadConfig: () => HarnessConfig;
  statePath: (config: HarnessConfig) => string;
  stageProblem: (stage: string, value: unknown, record?: string) => string | null;
  evaluateRun: (config: HarnessConfig) => RunEvaluation;
};

type RunState = {
  run: string;
  mode: string;
  stages: Record<string, string>;
  records: Record<string, string>;
};

export type StageStatus = "pending" | "done" | "skipped" | "n/a";

const postCodeStages = ["dev", "review", "code-review"];

async function loadGate(projectDirectory: string): Promise<Gate> {
  const gateFile = path.join(projectDirectory, "harness", "gate.mjs");
  if (!existsSync(gateFile)) {
    throw new Error("The harness is not installed in this project (harness/gate.mjs is missing).");
  }
  return (await import(pathToFileURL(gateFile).href)) as Gate;
}

async function readState(gate: Gate, config: HarnessConfig): Promise<RunState> {
  try {
    return JSON.parse(await readFile(gate.statePath(config), "utf8")) as RunState;
  } catch {
    throw new Error("No active harness run. Open one with harness_open_run.");
  }
}

async function writeState(gate: Gate, config: HarnessConfig, state: RunState): Promise<void> {
  await writeFile(gate.statePath(config), `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function stagesFor(mode: string, preCode: string[]): string[] {
  const post = mode === "chore" ? postCodeStages.filter((stage) => stage !== "code-review") : postCodeStages;
  return [...preCode, ...post];
}

function stageRow(stage: string, status: string, record = "", notes = ""): string {
  return `| ${stage} | ${status} | ${record} | ${notes} |`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function harnessStatus(projectDirectory: string): Promise<string> {
  const gate = await loadGate(projectDirectory);
  const run = gate.evaluateRun(gate.loadConfig());
  const lines = [run.summary, run.ready ? "Ready: guarded code may change." : "Not ready:"];
  return [...lines, ...run.problems.map((problem) => `  - ${problem}`)].join("\n");
}

export async function openRun(
  projectDirectory: string,
  input: { request: string; mode: string; reason: string; slug: string },
): Promise<string> {
  const gate = await loadGate(projectDirectory);
  const config = gate.loadConfig();
  const preCode = config.modes?.[input.mode];

  if (!Array.isArray(preCode)) {
    throw new Error(`Mode "${input.mode}" is not defined in harness/config.json.`);
  }
  if (existsSync(gate.statePath(config))) {
    throw new Error("A run is already active. Close or abandon it first, or continue it.");
  }

  const slug = input.slug.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const runFile = `docs/harness/runs/${today()}-${slug}.md`;
  const stages = stagesFor(input.mode, preCode);
  const mode = input.mode[0].toUpperCase() + input.mode.slice(1);

  const record = `# Run: ${input.request}

**Mode:** ${mode} — ${input.reason}
**Opened:** ${today()}   **Closed:**
**Status:** Open

| Stage | Status | Record | Notes |
|---|---|---|---|
${stages.map((stage) => stageRow(stage, "pending")).join("\n")}

## Approvals

## Result
`;

  await mkdir(path.join(projectDirectory, "docs/harness/runs"), { recursive: true });
  await writeFile(path.join(projectDirectory, runFile), record, "utf8");
  await writeState(gate, config, {
    run: runFile,
    mode: input.mode,
    stages: Object.fromEntries(stages.map((stage) => [stage, "pending"])),
    records: {},
  });

  return `Opened ${runFile} in mode ${input.mode} with stages: ${stages.join(", ")}.`;
}

async function updateRunRecord(
  projectDirectory: string,
  runFile: string,
  edit: (document: string) => string,
): Promise<void> {
  const file = path.join(projectDirectory, runFile);
  const document = await readFile(file, "utf8").catch(() => null);
  if (document !== null) await writeFile(file, edit(document), "utf8");
}

export async function setStage(
  projectDirectory: string,
  input: { stage: string; status: StageStatus; reason?: string; record?: string },
): Promise<string> {
  const gate = await loadGate(projectDirectory);
  const config = gate.loadConfig();
  const state = await readState(gate, config);

  if (!(input.stage in state.stages)) {
    throw new Error(`Stage "${input.stage}" is not in this run. Stages: ${Object.keys(state.stages).join(", ")}.`);
  }

  const reason = input.reason?.trim() ?? "";
  const value =
    input.status === "skipped" || input.status === "n/a" ? `${input.status}: ${reason}` : input.status;
  const problem = gate.stageProblem(input.stage, value, input.record);
  if (input.status !== "pending" && problem !== null) throw new Error(problem);

  state.stages[input.stage] = value;
  if (input.record) state.records[input.stage] = input.record;
  else delete state.records[input.stage];
  await writeState(gate, config, state);

  const row = stageRow(input.stage, value, input.record ?? "", input.status === "done" ? reason : "");
  await updateRunRecord(projectDirectory, state.run, (document) =>
    document.replace(new RegExp(`^\\| ${input.stage} \\|.*$`, "m"), row),
  );

  return `${input.stage}: ${value}\n\n${await harnessStatus(projectDirectory)}`;
}

export async function closeRun(
  projectDirectory: string,
  input: { status: "Closed" | "Abandoned"; result: string },
): Promise<string> {
  const gate = await loadGate(projectDirectory);
  const config = gate.loadConfig();
  const state = await readState(gate, config);

  if (input.status === "Closed") {
    const unsettled = Object.entries(state.stages)
      .map(([stage, value]) => gate.stageProblem(stage, value, state.records[stage]))
      .filter((problem): problem is string => problem !== null);
    if (unsettled.length > 0) {
      throw new Error(`The run cannot close yet:\n${unsettled.map((p) => `  - ${p}`).join("\n")}`);
    }
  }

  await updateRunRecord(projectDirectory, state.run, (document) =>
    document
      .replace(/^\*\*Opened:\*\*(.*?)\*\*Closed:\*\*.*$/m, `**Opened:**$1**Closed:** ${today()}`)
      .replace(/^\*\*Status:\*\* Open$/m, `**Status:** ${input.status}`)
      .replace(/## Result\n?([\s\S]*)$/, (_match, existing: string) => {
        const kept = existing.trim() === "" ? "" : `${existing.trimEnd()}\n\n`;
        return `## Result\n${kept}${input.result}\n`;
      }),
  );
  await unlink(gate.statePath(config));

  return `${state.run} is ${input.status}. docs/harness/active.json was removed.`;
}
