// Registers the Skills Code Kit MCP server with the project's AI tools,
// merged into each tool's existing configuration without touching the rest.

import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const serverName = "skills-code-kit";

type McpClient = {
  value: string;
  name: string;
  configFile: string;
  markers: string[];
  register: (configPath: string, command: string[]) => Promise<string>;
};

async function exists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function readJsonObject(file: string): Promise<Record<string, unknown>> {
  if (!(await exists(file))) return {};
  const parsed: unknown = JSON.parse(await readFile(file, "utf8"));
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${path.basename(file)} is not a JSON object`);
  }
  return parsed as Record<string, unknown>;
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function asObject(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

// Claude Code (.mcp.json) and Cursor (.cursor/mcp.json) share this format.
function mcpServersClient(
  value: string,
  name: string,
  configFile: string,
  markers: string[],
  extraArgs: string[] = [],
): McpClient {
  return {
    value,
    name,
    configFile,
    markers,
    register: async (configPath, [command, ...args]) => {
      const config = await readJsonObject(configPath);
      const servers = asObject(config.mcpServers);
      servers[serverName] = { command, args: [...args, ...extraArgs] };
      await writeJson(configPath, { ...config, mcpServers: servers });
      return configFile;
    },
  };
}

const openCode: McpClient = {
  value: "opencode",
  name: "OpenCode",
  configFile: "opencode.json",
  markers: [".opencode", "opencode.json", "opencode.jsonc"],
  register: async (configPath, command) => {
    if (await exists(path.join(path.dirname(configPath), "opencode.jsonc"))) {
      throw new Error("opencode.jsonc may contain comments, so it was not rewritten");
    }
    const config = await readJsonObject(configPath);
    const servers = asObject(config.mcp);
    servers[serverName] = { type: "local", command, enabled: true };
    await writeJson(configPath, {
      $schema: "https://opencode.ai/config.json",
      ...config,
      mcp: servers,
    });
    return "opencode.json";
  },
};

const codex: McpClient = {
  value: "codex",
  name: "Codex",
  configFile: ".codex/config.toml",
  markers: [".codex"],
  register: async (configPath, [command, ...args]) => {
    const current = (await exists(configPath)) ? await readFile(configPath, "utf8") : "";
    const header = `[mcp_servers.${serverName}]`;

    if (current.includes(header)) {
      throw new Error(`${header} is already in .codex/config.toml; update it by hand if needed`);
    }

    const section = `${header}\ncommand = ${JSON.stringify(command)}\nargs = ${JSON.stringify(args)}\n`;
    const separator = current === "" || current.endsWith("\n\n") ? "" : current.endsWith("\n") ? "\n" : "\n\n";
    await mkdir(path.dirname(configPath), { recursive: true });
    await writeFile(configPath, `${current}${separator}${section}`, "utf8");
    return ".codex/config.toml";
  },
};

export const mcpClients: McpClient[] = [
  mcpServersClient("claude", "Claude Code", ".mcp.json", [".claude", "CLAUDE.md", ".mcp.json"]),
  // Cursor may not start project servers in the workspace folder.
  mcpServersClient("cursor", "Cursor", ".cursor/mcp.json", [".cursor"], ["--project", "${workspaceFolder}"]),
  openCode,
  codex,
];

export async function detectMcpClients(projectDirectory: string): Promise<McpClient[]> {
  const detected: McpClient[] = [];

  for (const client of mcpClients) {
    const found = await Promise.all(
      client.markers.map((marker) => exists(path.join(projectDirectory, marker))),
    );
    if (found.some(Boolean)) detected.push(client);
  }

  return detected;
}

// Pinned to the installed kit's version, so the server matches the templates.
export function serverCommand(version: string): string[] {
  return ["npx", "-y", `skills-code-kit@${version}`, "mcp"];
}

export async function registerMcpServer(
  projectDirectory: string,
  clients: McpClient[],
  version: string,
): Promise<void> {
  const command = serverCommand(version);

  for (const client of clients) {
    try {
      const file = await client.register(path.join(projectDirectory, client.configFile), command);
      console.log(`  ✓ ${client.name}: ${file}`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.log(`  - ${client.name}: skipped (${reason}). Add a server named "${serverName}" running: ${command.join(" ")}`);
    }
  }
}
