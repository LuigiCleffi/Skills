// Native agent files for the Scrum team, one set per AI coding tool.
//
// Each agent is a thin wrapper: it points the tool's sub-agent at the role
// file and the board, so the role's instructions live only in scrum/roles/.

import { access } from "node:fs/promises";
import path from "node:path";

export type AgentTool = {
  value: "claude" | "opencode" | "codex";
  name: string;
  // Files or folders whose presence in the project shows the tool is used.
  markers: string[];
  agentFile: (role: ScrumRole) => GeneratedFile;
};

export type GeneratedFile = { path: string; content: string };

type ScrumRole = {
  id: string;
  title: string;
  description: string;
};

const scrumRoles: ScrumRole[] = [
  {
    id: "po",
    title: "PO (Product Owner)",
    description:
      "Product Owner of the Scrum team. Use for backlog refinement, acceptance criteria, the Sprint Goal proposal, and checking the increment against acceptance criteria at the Sprint Review.",
  },
  {
    id: "pm",
    title: "PM (Project Manager and Scrum Master)",
    description:
      "Project Manager and Scrum Master of the Scrum team. Use to set up or update the board in docs/scrum/, facilitate a ceremony, log the Daily Scrum, track impediments, and close a sprint.",
  },
  {
    id: "tech-lead",
    title: "Tech Lead",
    description:
      "Tech Lead of the Scrum team, between the PO and PM and the developers. Use to check technical readiness, design an item, break it into tasks for Dev, DBA, or DevOps, consult or propose ADRs, and review tasks before Done.",
  },
  {
    id: "dev",
    title: "Dev (full-stack developer)",
    description:
      "Full-stack Developer of the Scrum team. Use to work a Dev task from the sprint board: production code and tests, front end to back end, including routine database work.",
  },
  {
    id: "dba",
    title: "DBA",
    description:
      "DBA of the Scrum team. Use to work a database task from the sprint board: schema changes, migrations with rollback, indexes and query performance, data security.",
  },
  {
    id: "devops",
    title: "DevOps",
    description:
      "DevOps engineer of the Scrum team. Use to work an infrastructure task from the sprint board: CI/CD, infrastructure as code, environments, deployment, monitoring.",
  },
];

function agentName(role: ScrumRole): string {
  return `scrum-${role.id}`;
}

function agentInstructions(role: ScrumRole): string {
  return `You are the ${role.title} of the project's Scrum team.

1. Read \`scrum/README.md\`, then \`scrum/roles/${role.id}.md\`, and follow them. They are the source of truth for this role.
2. Read the board in \`docs/scrum/\` before acting. Continue from what it records, not from assumptions.
3. Prefix your notes and board entries with the role tag the role file uses.
4. Act only within this role. Work that belongs to another role goes into your handoff.
5. You cannot ask the user anything. When you reach an approval gate (G1 to G4) or a question only the user can answer, stop and return it to the caller with the context the user needs to decide.
6. End with the role's handoff: what you did, what you wrote to the board, and who takes over next.
`;
}

// Quoted with JSON rules, which are valid YAML and TOML basic strings.
function quoted(text: string): string {
  return JSON.stringify(text);
}

export const agentTools: AgentTool[] = [
  {
    value: "claude",
    name: "Claude Code",
    markers: [".claude", "CLAUDE.md"],
    agentFile: (role) => ({
      path: `.claude/agents/${agentName(role)}.md`,
      content: `---
name: ${agentName(role)}
description: ${quoted(role.description)}
---

${agentInstructions(role)}`,
    }),
  },
  {
    value: "opencode",
    name: "OpenCode",
    markers: [".opencode", "opencode.json", "opencode.jsonc"],
    agentFile: (role) => ({
      path: `.opencode/agents/${agentName(role)}.md`,
      content: `---
description: ${quoted(role.description)}
mode: subagent
---

${agentInstructions(role)}`,
    }),
  },
  {
    value: "codex",
    name: "Codex",
    markers: [".codex"],
    agentFile: (role) => ({
      path: `.codex/agents/${agentName(role)}.toml`,
      content: `name = ${quoted(agentName(role))}
description = ${quoted(role.description)}
developer_instructions = '''
${agentInstructions(role)}'''
`,
    }),
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

export async function detectAgentTools(
  projectDirectory: string,
): Promise<AgentTool[]> {
  const detected: AgentTool[] = [];

  for (const tool of agentTools) {
    const markerChecks = tool.markers.map((marker) =>
      exists(path.join(projectDirectory, marker)),
    );

    if ((await Promise.all(markerChecks)).some(Boolean)) detected.push(tool);
  }

  return detected;
}

export function generateAgentFiles(tools: AgentTool[]): GeneratedFile[] {
  return tools.flatMap((tool) => scrumRoles.map(tool.agentFile));
}
