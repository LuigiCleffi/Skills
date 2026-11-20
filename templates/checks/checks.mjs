#!/usr/bin/env node
//
// Checks before a pull request: runs, on the commit that goes into the PR,
// the checks its diff reaches (the ones listed in checks/config.json), and
// stamps the commit when they pass. As a Claude Code hook, it refuses to open
// a pull request from a commit with no stamp.
//
// Why: a rule nobody runs is a sentence. A template that says "tests pass"
// and an agent that opens the PR before running them is how red pull
// requests happen. The stamp makes "it ran on this commit" checkable.
//
// It does not replace CI: CI proves on a clean machine. This stops the agent
// from opening a pull request it would see go red.
//
// Usage:
//   node checks/checks.mjs [--base origin/main]   run what the diff reaches; stamp HEAD when green
//   node checks/checks.mjs --waive "reason"       stamp HEAD without running; repeat the reason in the PR
//   node checks/checks.mjs status                 say whether HEAD is stamped
//   node checks/checks.mjs hook                   PreToolUse hook (reads the hook JSON; exit 2 refuses)
//   node checks/checks.mjs pre-push               git pre-push hook: reads git's ref lines on stdin
//
// As a git pre-push hook (.git/hooks/pre-push or .husky/pre-push):
//   node checks/checks.mjs pre-push
// It checks each commit being pushed to a branch, not HEAD, and does nothing
// for a commit already stamped against the same base. No dependencies beyond
// Node.js 20.

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REFUSED = 2;
const checksFile = fileURLToPath(import.meta.url);
const checksDirectory = path.dirname(checksFile);
export const projectDirectory = path.resolve(checksDirectory, "..");

export function loadConfig() {
  return JSON.parse(readFileSync(path.join(checksDirectory, "config.json"), "utf8"));
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

export function matchesAny(file, globs = []) {
  return globs.some((glob) => globToRegExp(glob).test(file));
}

// The checks the changed files reach, in config order. A check with "when"
// runs when a changed file matches it, even one "ignore" lists (a diagram
// check on Markdown). A check without "when" runs when anything outside
// "ignore" changed (docs, say, reach nothing).
export function plannedChecks(config, files) {
  const relevant = files.filter((file) => !matchesAny(file, config.ignore ?? []));
  return (config.checks ?? []).filter((check) =>
    check.when ? files.some((file) => matchesAny(file, check.when)) : relevant.length > 0,
  );
}

// Whether a tool call opens a pull request: `gh pr create`, a `gh api` call
// that writes to repos/<owner>/<repo>/pulls, or an MCP create_pull_request.
const apiPulls = /\brepos\/[^\s/'"]+\/[^\s/'"]+\/pulls(?=$|[\s'"?])/;
const apiWrites = /(?:^|\s)(?:-X\s*POST|--method[=\s]+POST|--input\b|-[fF]\s|--field\b|--raw-field\b)/;

export function opensPullRequest(toolName, toolInput) {
  if (/^mcp__.*create_pull_request$/.test(toolName ?? "")) return true;
  if (toolName !== "Bash") return false;
  const command = String(toolInput?.command ?? "");
  if (/\bgh\s+pr\s+create\b/.test(command)) return true;
  return /\bgh\s+api\b/.test(command) && apiPulls.test(command) && apiWrites.test(command);
}

function git(args, cwd = projectDirectory) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

function stampPath(sha, cwd = projectDirectory) {
  return path.resolve(cwd, git(["rev-parse", "--git-common-dir"], cwd), "skills-code-kit-checks", `${sha}.json`);
}

export function readStamp(sha, cwd = projectDirectory) {
  try {
    return JSON.parse(readFileSync(stampPath(sha, cwd), "utf8"));
  } catch {
    return null;
  }
}

function writeStamp(sha, stamp) {
  const file = stampPath(sha);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify({ sha, at: new Date().toISOString(), ...stamp }, null, 2)}\n`);
}

// Whether a stamp still certifies the commit. A waiver always stands. A run
// stands while the branch still starts where the checks measured it from:
// once the base moved (a rebase, or a merge of main into the branch changes
// the merge base), the same commit sits on different code, so it is checked
// again. When the base cannot be read here (not fetched), the stamp stands:
// the hook is a safety net, and CI still runs.
export function stampStands(stamp, currentBaseSha) {
  if (!stamp) return false;
  if (stamp.waived) return true;
  if (!stamp.baseSha || !currentBaseSha) return true;
  return stamp.baseSha === currentBaseSha;
}

function currentBaseSha(sha, base, cwd = projectDirectory) {
  try {
    return git(["merge-base", base, sha], cwd);
  } catch {
    return null;
  }
}

function configuredBase(cwd = projectDirectory) {
  try {
    return JSON.parse(readFileSync(path.join(cwd, "checks", "config.json"), "utf8")).base ?? "origin/main";
  } catch {
    return loadConfig().base ?? "origin/main";
  }
}

// The commit a PR would open from: the MCP call names its head branch;
// otherwise HEAD.
function headSha(cwd, toolInput) {
  for (const ref of toolInput?.head ? [toolInput.head, `origin/${toolInput.head}`] : []) {
    try {
      return git(["rev-parse", "--verify", `${ref}^{commit}`], cwd);
    } catch {
      // try the next spelling of the branch
    }
  }
  return git(["rev-parse", "HEAD"], cwd);
}

// The refusal reason for one tool call, or null to let it through. Fails
// open outside a git repository.
export function hookProblem(input) {
  if (!opensPullRequest(input?.tool_name, input?.tool_input)) return null;
  let sha;
  try {
    sha = headSha(input.cwd || projectDirectory, input.tool_input);
  } catch {
    return null;
  }
  const cwd = input.cwd || projectDirectory;
  const stamp = readStamp(sha, cwd);
  if (stampStands(stamp, stamp ? currentBaseSha(sha, stamp.base ?? configuredBase(cwd), cwd) : null)) return null;
  const why = stamp
    ? `the base moved since the checks ran on commit ${sha.slice(0, 9)} (a rebase or a merge of ${stamp.base}), so they run again`
    : `the checks have not passed on commit ${sha.slice(0, 9)}`;
  return (
    `Checks: ${why}; the pull request does not open. ` +
    "Run `node checks/checks.mjs` and fix what fails. If the checks do not apply, " +
    '`node checks/checks.mjs --waive "<reason>"` and repeat the reason in the pull request body.'
  );
}

function changedFiles(base, sha = "HEAD") {
  const mergeBase = git(["merge-base", base, sha]);
  return { baseSha: mergeBase, files: git(["diff", "--name-only", `${mergeBase}..${sha}`]).split("\n").filter(Boolean) };
}

// Inside a git hook, git sets variables (GIT_DIR, GIT_INDEX_FILE, ...) that
// point every git command at this repository. A check that runs git in a
// temporary folder (a test fixture's git init) would then rewrite this
// repository instead, so the checks run without them.
const hookGitVariables = [
  "GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_PREFIX", "GIT_QUARANTINE_PATH",
  "GIT_OBJECT_DIRECTORY", "GIT_ALTERNATE_OBJECT_DIRECTORIES", "GIT_COMMON_DIR",
];

export function checkEnvironment(environment = process.env) {
  const clean = { ...environment };
  for (const name of hookGitVariables) delete clean[name];
  return clean;
}

// The pushes git announces on a pre-push hook's stdin, one line per ref:
// "<local ref> <local sha> <remote ref> <remote sha>". Only pushes that put a
// commit on a branch count: deleting a ref and pushing a tag do not. Decided
// by the destination, since the local side is the refspec as typed (HEAD, a
// sha), so "git push origin HEAD:refs/heads/x" is checked too.
export function pushedCommits(stdin) {
  return stdin
    .split("\n")
    .map((line) => line.trim().split(/\s+/))
    .filter(([, localSha, remoteRef]) => remoteRef?.startsWith("refs/heads/") && localSha && !/^0+$/.test(localSha))
    .map(([, localSha, remoteRef]) => ({ sha: localSha, branch: remoteRef.slice("refs/heads/".length) }));
}

function option(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : (args[index + 1] ?? "");
}

function runStatus() {
  const sha = git(["rev-parse", "HEAD"]);
  const stamp = readStamp(sha);
  if (!stamp) {
    console.log(`${sha.slice(0, 9)}: not stamped. Run node checks/checks.mjs.`);
    return 1;
  }
  if (!stampStands(stamp, currentBaseSha(sha, stamp.base ?? configuredBase()))) {
    console.log(`${sha.slice(0, 9)}: stamped against an older ${stamp.base}; the base moved, so run node checks/checks.mjs again.`);
    return 1;
  }
  console.log(
    stamp.waived
      ? `${sha.slice(0, 9)}: waived — ${stamp.waived}`
      : `${sha.slice(0, 9)}: passed ${stamp.checks.map((check) => check.name).join(", ") || "(nothing to check)"} against ${stamp.base}`,
  );
  return 0;
}

function runChecks(config, args) {
  const sha = git(["rev-parse", "HEAD"]);
  const waiver = option(args, "--waive");

  if (waiver !== undefined) {
    if (waiver.trim().length < 10) {
      console.error('checks: --waive needs the reason in a sentence; it goes into the stamp and the pull request repeats it.');
      return 1;
    }
    writeStamp(sha, { waived: waiver.trim() });
    console.log(`Checks waived on ${sha.slice(0, 9)}: ${waiver.trim()}. Repeat the reason in the pull request body.`);
    return 0;
  }

  return checkCommit(config, sha, option(args, "--base") ?? config.base ?? "origin/main");
}

// Runs the checks for one commit, which must be the checked-out one (the
// checks run on the working tree), and stamps it when they pass.
function checkCommit(config, sha, base) {
  const previous = readStamp(sha);
  if (previous?.waived) {
    console.log(`Checks waived on ${sha.slice(0, 9)}: ${previous.waived}`);
    return 0;
  }
  if (previous && stampStands(previous, currentBaseSha(sha, base))) {
    console.log(`Checks already passed on ${sha.slice(0, 9)} against ${previous.base}.`);
    return 0;
  }

  if (git(["rev-parse", "HEAD"]) !== sha) {
    console.error(`checks: ${sha.slice(0, 9)} is not the checked-out commit, and the checks run on the working tree. Check it out and run node checks/checks.mjs, then push again.`);
    return 1;
  }

  // A stamp certifies a commit, so the work must be in it.
  if (git(["status", "--porcelain", "--untracked-files=no"])) {
    console.error("checks: commit or stash your changes first; a stamp certifies a commit, not the working tree.");
    return 1;
  }

  let diff;
  try {
    diff = changedFiles(base, sha);
  } catch {
    console.error(`checks: cannot find ${base} to compare with. Fetch it, or pass --base <branch>.`);
    return 1;
  }

  const planned = plannedChecks(config, diff.files);
  console.log(`${diff.files.length} file(s) changed since ${base}; ${planned.length} check(s) to run.`);

  const results = [];
  for (const check of planned) {
    console.log(`\n▶ ${check.name}: ${check.command}`);
    const result = spawnSync(check.command, { cwd: projectDirectory, shell: true, stdio: "inherit", env: checkEnvironment() });
    results.push({ name: check.name, command: check.command, ok: result.status === 0 });
    if (result.status !== 0) {
      console.error(`\n✗ ${check.name} failed. Fix it, commit, and run the checks again.`);
      return 1;
    }
  }

  writeStamp(sha, { base, baseSha: diff.baseSha, checks: results });
  console.log(`\n✓ Checks passed; stamped ${sha.slice(0, 9)}.`);
  return 0;
}

function runHook() {
  let input;
  try {
    input = JSON.parse(readFileSync(0, "utf8"));
  } catch {
    return 0;
  }
  const problem = hookProblem(input);
  if (!problem) return 0;
  console.error(problem);
  return REFUSED;
}

// As a git pre-push hook: every commit about to land on a branch must carry a
// standing stamp, or be the checked-out commit so the checks can run now.
function runPrePush(config) {
  let stdin = "";
  try {
    stdin = readFileSync(0, "utf8");
  } catch {}
  const base = config.base ?? "origin/main";
  for (const { sha, branch } of pushedCommits(stdin)) {
    console.log(`checks: pushing ${sha.slice(0, 9)} to ${branch}`);
    const code = checkCommit(config, sha, base);
    if (code !== 0) return code;
  }
  return 0;
}

function main() {
  const args = process.argv.slice(2);
  if (args[0] === "hook") return runHook();
  if (args[0] === "pre-push") return runPrePush(loadConfig());
  if (args[0] === "status") return runStatus();
  return runChecks(loadConfig(), args);
}

function isEntryPoint() {
  try {
    return process.argv[1] !== undefined && realpathSync(process.argv[1]) === realpathSync(checksFile);
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(`checks: ${error.message}`);
    // The hook fails open: a broken check must not stop every command.
    process.exitCode = process.argv[2] === "hook" ? 0 : 1;
  }
}
