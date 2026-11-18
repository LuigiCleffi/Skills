#!/usr/bin/env node
//
// Guards: a Claude Code PreToolUse hook that refuses the few things whose
// damage does not come back: reading or leaking a secret, writing a file the
// project's tools must own (migrations, generated code), a destructive shell
// command, committing or pushing to a protected branch, and changing a
// production cloud environment from the shell. Configured in
// guards/config.json. No dependencies beyond Node.js 20.
//
// It blocks only irreversible damage. A recoverable mistake (skipping a
// workflow stage, a file in the wrong format) is told, not blocked: see the
// harness gate. A guard that blocks recoverable mistakes gets switched off.
//
// It reads the tool call, not the shell's mind: it parses the command text,
// so it is a safety net against accidents, not a sandbox.
//
// Usage: node guards/guard.mjs   (reads the hook JSON on stdin; exit 2 blocks)

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BLOCKED = 2;
const guardFile = fileURLToPath(import.meta.url);
const guardDirectory = path.dirname(guardFile);
export const projectDirectory = path.resolve(guardDirectory, "..");

export function loadConfig() {
  return JSON.parse(readFileSync(path.join(guardDirectory, "config.json"), "utf8"));
}

function globToRegExp(glob) {
  let pattern = "";
  for (let i = 0; i < glob.length; i += 1) {
    const char = glob[i];
    if (char === "*" && glob[i + 1] === "*") {
      const followedBySlash = glob[i + 2] === "/";
      pattern += followedBySlash ? "(?:.*/)?" : ".*";
      i += followedBySlash ? 2 : 1;
    } else if (char === "*") {
      pattern += "[^/]*";
    } else if (char === "?") {
      pattern += "[^/]";
    } else {
      pattern += char.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${pattern}$`);
}

function matchesAny(candidate, globs) {
  return globs.some((glob) => globToRegExp(glob).test(candidate));
}

// The forms a path is matched in: relative to the project when it is inside
// it, and the absolute path without its leading slash, so "**/x" globs match
// files anywhere (~/.ssh/id_rsa, for one).
function pathForms(filePath, cwd = projectDirectory) {
  const absolute = path.resolve(cwd, filePath.replace(/^~(?=\/|$)/, process.env.HOME ?? "~"));
  const forms = [absolute.replace(/^\/+/, "")];
  let root = projectDirectory;
  try {
    root = realpathSync(projectDirectory);
  } catch {}
  for (const base of new Set([projectDirectory, root])) {
    const relative = path.relative(base, absolute);
    if (!relative.startsWith("..") && !path.isAbsolute(relative)) forms.unshift(relative);
  }
  return forms.map((form) => form.split(path.sep).join("/"));
}

export function isSecret(config, filePath, cwd) {
  const secrets = config.secrets ?? {};
  const forms = pathForms(filePath, cwd);
  return (
    forms.some((form) => matchesAny(form, secrets.files ?? [])) &&
    !forms.some((form) => matchesAny(form, secrets.allow ?? []))
  );
}

export function isProtected(config, filePath, cwd) {
  return pathForms(filePath, cwd).some((form) => matchesAny(form, config.protectedPaths ?? []));
}

// Splits a command into segments (at ; && || | newline and subshell parens)
// and each segment into words, honoring quotes and escapes. Redirect targets
// are kept as { redirect: path }. A heredoc body is data, so it is dropped.
export function parseCommand(command) {
  const withoutHeredocs = command.replace(
    /<<-?\s*(['"]?)(\w+)\1[^\n]*\n[\s\S]*?\n\s*\2\s*(?=\n|$)/g,
    (match) => match.split("\n")[0].replace(/<<-?\s*(['"]?)\w+\1/, ""),
  );
  const segments = [];
  let words = [];
  let word = "";
  let quote = null;
  let pendingRedirect = false;
  let hasWord = false;

  const endWord = () => {
    if (!hasWord) return;
    if (pendingRedirect) {
      words.push({ redirect: word });
      pendingRedirect = false;
    } else {
      words.push(word);
    }
    word = "";
    hasWord = false;
  };
  const endSegment = () => {
    endWord();
    if (words.length > 0) segments.push(words);
    words = [];
  };

  for (let i = 0; i < withoutHeredocs.length; i += 1) {
    const char = withoutHeredocs[i];
    if (quote) {
      if (char === quote) quote = null;
      else if (char === "\\" && quote === '"' && i + 1 < withoutHeredocs.length) word += withoutHeredocs[++i];
      else word += char;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      hasWord = true;
    } else if (char === "\\" && i + 1 < withoutHeredocs.length) {
      word += withoutHeredocs[++i];
      hasWord = true;
    } else if (/\s/.test(char) && char !== "\n") {
      endWord();
    } else if (char === "\n" || char === ";" || char === "(" || char === ")") {
      endSegment();
    } else if (char === "&" || char === "|") {
      if (withoutHeredocs[i + 1] === ">") {
        endWord();
      } else {
        endSegment();
        if (withoutHeredocs[i + 1] === char) i += 1;
      }
    } else if (char === ">") {
      if (/^\d+$/.test(word)) {
        word = ""; // The "2" of 2>file is a file descriptor.
        hasWord = false;
      }
      endWord();
      if (withoutHeredocs[i + 1] === ">") i += 1;
      if (withoutHeredocs[i + 1] === "&") {
        i += 1; // 2>&1 and the like: a file descriptor, not a file.
        while (/\d/.test(withoutHeredocs[i + 1] ?? "")) i += 1;
        continue;
      }
      pendingRedirect = true;
    } else if (char === "<") {
      endWord();
    } else {
      word += char;
      hasWord = true;
    }
  }
  endSegment();
  return segments;
}

const wrappers = new Set(["sudo", "env", "nice", "nohup", "time", "command", "exec", "xargs"]);

// The command name and its arguments, past env assignments and wrappers.
function commandOf(segment) {
  const plain = segment.filter((item) => typeof item === "string");
  let index = 0;
  while (index < plain.length) {
    const token = plain[index];
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(token)) {
      index += 1;
    } else if (wrappers.has(path.basename(token))) {
      index += 1;
      while (index < plain.length && plain[index].startsWith("-")) index += 1;
    } else {
      break;
    }
  }
  const name = plain[index] === undefined ? "" : path.basename(plain[index]);
  return { name, args: plain.slice(index + 1) };
}

// Words that may name a file: plain arguments, @file (curl), and --flag=file.
function fileWords(args) {
  return args
    .filter((arg) => arg !== "" && arg !== "-")
    .map((arg) => arg.replace(/^@/, "").replace(/^--?[\w-]+=/, ""))
    .filter((arg) => !arg.startsWith("-"));
}

const harmlessWithSecrets = new Set(["ls", "test", "[", "stat"]);
const destinationOnly = new Set(["cp", "install", "ln", "rsync", "scp"]);
const writesArguments = new Set(["mv", "rm", "touch", "tee", "truncate", "mkdir", "rmdir", "unlink", "chmod", "chown"]);

function currentBranch(cwd) {
  try {
    // Works on a branch with no commits yet, unlike rev-parse HEAD.
    return execFileSync("git", ["branch", "--show-current"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim() || null;
  } catch {
    return null;
  }
}

function hasLocalGitHooks() {
  return [".husky", "lefthook.yml", ".lefthook.yml", ".pre-commit-config.yaml"].some((file) =>
    existsSync(path.join(projectDirectory, file)),
  );
}

function dangerousReason(name, args, branch) {
  const flags = args.filter((arg) => arg.startsWith("-")).join(" ");
  const recursive = /(^|\s)-[a-zA-Z]*r|--recursive/i.test(flags);
  const force = /(^|\s)-[a-zA-Z]*f|--force(\s|$)/.test(flags);

  if (name === "rm" && recursive && force) {
    const targets = fileWords(args);
    if (targets.some((target) => ["/", "/*", "~", "~/", "~/*", "$HOME", "${HOME}", "*", ".", "./", ".."].includes(target))) {
      return "rm -rf on the root, the home folder, or the whole working folder";
    }
  }
  if (name === "git") {
    const sub = args.find((arg) => !arg.startsWith("-"));
    if (sub === "reset" && args.includes("--hard")) return "git reset --hard discards uncommitted work";
    if (sub === "clean" && /(^|\s)-[a-zA-Z]*f|--force/.test(flags)) return "git clean -f deletes untracked files";
    if (sub === "push") {
      const forced =
        args.some((arg) => arg === "--force" || /^-[a-zA-Z]*f[a-zA-Z]*$/.test(arg) || arg.startsWith("+"));
      const toMain = args.some((arg) => /(^|[:+/])(main|master)$/.test(arg)) || ["main", "master"].includes(branch);
      if (forced && toMain) return "a force push to main or master rewrites shared history";
    }
    if ((sub === "commit" || sub === "push") && (args.includes("--no-verify") || (sub === "commit" && args.includes("-n")))) {
      if (hasLocalGitHooks()) return `git ${sub} --no-verify skips the project's git hooks`;
    }
  }
  if (name === "chmod" && args.some((arg) => /^0?777$/.test(arg))) return "chmod 777 makes files writable by everyone";
  if (name.startsWith("mkfs")) return "mkfs formats a disk";
  if (name === "dd" && args.some((arg) => /^of=\/dev\//.test(arg))) return "dd onto a device overwrites it";
  return null;
}

// Cloud CLIs whose subcommands are read-only. Anything not listed counts as a
// change: the CLIs grow new verbs all the time, and a new verb that writes
// must not pass until someone notices.
const cloudReadVerbs = {
  gcloud: /^(list|describe|get|get-iam-policy|read|tail|logs?|help|info|version|config|auth|components)$/,
  aws: /^((describe|get|list|head|show|wait)(-.*)?|help|ls|configure)$/,
  az: /^((list|show|get)(-.*)?|help|version|account|login|find)$/,
  kubectl: /^(get|describe|logs|top|explain|version|api-resources|api-versions|auth|config|diff|cluster-info|wait)$/,
  helm: /^(list|ls|get|status|history|show|search|template|lint|version|env|repo|diff)$/,
  terraform: /^(plan|show|validate|output|fmt|version|providers|graph|init|workspace|console|state)$/,
};
const terraformStateWrites = /^(rm|mv|push|replace-provider)$/;

function hasMarker(words, markers) {
  return words.some((word) =>
    word
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .some((part) => markers.includes(part)),
  );
}

// Returns why a cloud command would change production, or null. The command
// names its target in its arguments or environment (a project, account,
// context, or var file). A production marker in them ("prod") refuses it.
// With requireNonProduction, a change passes only when a non-production
// marker ("staging") names the target: a target the command does not name
// could be production, since the CLI's current project or context decides.
function productionReason(config, segment, name, args) {
  const settings = config.production ?? {};
  const lower = (list) => (list ?? []).map((marker) => marker.toLowerCase());
  const markers = lower(settings.markers);
  const safe = lower(settings.nonProductionMarkers);
  const reads = cloudReadVerbs[name];
  if (!reads || (markers.length === 0 && !settings.requireNonProduction)) return null;

  const verbs = args.filter((arg) => !arg.startsWith("-"));
  // aws and az take a service first (aws s3 cp), gcloud a group or two
  // (gcloud run services delete): the verb is the first word that is one.
  const isRead =
    verbs.length === 0 ||
    (verbs.some((verb) => reads.test(verb)) &&
      !(name === "terraform" && verbs[0] === "state" && terraformStateWrites.test(verbs[1] ?? "")) &&
      !(name === "terraform" && verbs[0] === "init" && args.some((arg) => /^-(migrate-state|reconfigure)/.test(arg))));
  if (isRead) return null;

  const env = segment.filter((item) => typeof item === "string" && /^[A-Za-z_][A-Za-z0-9_]*=/.test(item));
  const words = [...args, ...env];
  const action = `${name} ${verbs.slice(0, 3).join(" ")}`;
  if (hasMarker(words, markers)) {
    return `${action} changes production (guards/config.json "production"); production changes go through the deploy pipeline or the user`;
  }
  if (settings.requireNonProduction && !hasMarker(words, safe)) {
    return `${action} changes a target the command does not prove is non-production; name it explicitly (${safe.join(", ") || "set nonProductionMarkers"}) or ask the user`;
  }
  return null;
}

// Returns why a shell command must not run, or null.
export function bashProblem(config, command, cwd = projectDirectory) {
  const segments = parseCommand(command);
  const branch = (config.protectedBranches ?? []).length > 0 || config.dangerousCommands !== false ? currentBranch(cwd) : null;

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const { name, args } = commandOf(segment);
    const redirects = segment.filter((item) => typeof item === "object").map((item) => item.redirect);
    const words = fileWords(args);

    // A download piped into a shell runs whatever the server sends.
    if (["sh", "bash", "zsh", "dash"].includes(name) && args.length === 0 && index > 0) {
      const previous = commandOf(segments[index - 1]).name;
      if (previous === "curl" || previous === "wget") {
        return "piping a download into a shell runs code nobody reviewed";
      }
    }

    if (name === "printenv" || ((name === "env" || name === "export") && args.every((arg) => arg === "-p"))) {
      return "dumping the environment prints every secret in it";
    }

    if (!harmlessWithSecrets.has(name)) {
      const secret = [...words, ...redirects].find((word) => isSecret(config, word, cwd));
      if (secret) return `${secret} holds secrets; read the .example file or ask the user for the value you need`;
    }

    const writeTargets = [
      ...redirects,
      ...(destinationOnly.has(name) ? words.slice(-1) : []),
      ...(writesArguments.has(name) ? words : []),
      ...((name === "sed" || name === "perl") && args.some((arg) => /^-[a-zA-Z]*i/.test(arg)) ? words : []),
    ];
    const protectedTarget = writeTargets.find((word) => isProtected(config, word, cwd));
    if (protectedTarget) return `${protectedTarget} is protected (guards/config.json "protectedPaths"); let the project's tool write it`;

    const production = productionReason(config, segment, name, args);
    if (production) return production;

    if (config.dangerousCommands !== false) {
      const reason = dangerousReason(name, args, branch);
      if (reason) return `${reason}; ask the user to run it themselves if it is really intended`;
    }

    if (name === "git" && branch && (config.protectedBranches ?? []).includes(branch)) {
      const sub = args.find((arg) => !arg.startsWith("-"));
      if (sub === "commit" || sub === "push") {
        return `the current branch is ${branch}, which is protected; create a branch first`;
      }
    }
  }
  return null;
}

// Returns why the tool call must not run, or null.
export function toolProblem(config, input) {
  const tool = input.tool_name ?? "";
  const toolInput = input.tool_input ?? {};
  const cwd = typeof input.cwd === "string" ? input.cwd : projectDirectory;

  if (tool === "Bash") {
    return typeof toolInput.command === "string" ? bashProblem(config, toolInput.command, cwd) : null;
  }

  const target = toolInput.file_path ?? toolInput.notebook_path ?? toolInput.path;
  if (typeof target !== "string") return null;

  if (isSecret(config, target, cwd)) {
    return `${target} holds secrets; read the .example file or ask the user for the value you need`;
  }
  if (tool !== "Read" && tool !== "Grep" && tool !== "Glob" && isProtected(config, target, cwd)) {
    return `${target} is protected (guards/config.json "protectedPaths"); let the project's tool write it`;
  }
  return null;
}

function main() {
  let input;
  try {
    input = JSON.parse(readFileSync(0, "utf8") || "{}");
  } catch {
    return 0; // Not a hook payload: nothing to guard, and blocking every call would cost more.
  }
  const problem = toolProblem(loadConfig(), input);
  if (!problem) return 0;
  console.error(`Guard: blocked. ${problem}.`);
  return BLOCKED;
}

function isEntryPoint() {
  try {
    return process.argv[1] !== undefined && realpathSync(process.argv[1]) === realpathSync(guardFile);
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(`Guard failed: ${error.message}`);
    process.exitCode = 0; // A broken guard reports itself without stopping every tool call.
  }
}
