#!/usr/bin/env node
//
// Worktree slots: lets several agent sessions run the app at once, each in its
// own git worktree, without colliding on ports or sharing a database.
//
// Each worktree gets a slot number that stays the same while it exists: the
// main checkout is slot 0, and a new worktree takes the lowest free slot. The
// slot sets the ports (base + slot * portStep) and fills {slot} and {suffix}
// in the other variables ({suffix} is "" in slot 0 and "_wt<slot>" elsewhere),
// all from tools/worktree.json. The result is written to .worktree-slot.env
// in the worktree for the app's scripts to load.
//
// Usage (from inside any worktree):
//   node tools/worktree-slot.mjs           # assign or reuse this worktree's slot and write the file
//   node tools/worktree-slot.mjs --print   # print the variables without writing
//   node tools/worktree-slot.mjs --list    # list every worktree and its slot
//
// It does not create databases or start anything: create the database named
// in the file with the project's own tool. No dependencies beyond Node.js 20.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptFile = fileURLToPath(import.meta.url);
const configFile = path.join(path.dirname(scriptFile), "worktree.json");
const slotsFileName = "skills-code-kit-worktree-slots.json";

function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function realPath(directory) {
  try {
    return realpathSync(directory);
  } catch {
    return path.resolve(directory);
  }
}

// The worktrees git knows, main checkout first.
export function listWorktrees(cwd) {
  return git(["worktree", "list", "--porcelain"], cwd)
    .split("\n")
    .filter((line) => line.startsWith("worktree "))
    .map((line) => realPath(line.slice("worktree ".length)));
}

// Gives the main checkout slot 0 and every other worktree the slot it already
// has, or the lowest free one. Slots of removed worktrees are freed.
export function assignSlots(worktrees, previous = {}) {
  const slots = {};
  const [main, ...others] = worktrees;
  if (main) slots[main] = 0;
  for (const worktree of others) {
    if (Number.isInteger(previous[worktree]) && previous[worktree] > 0) slots[worktree] = previous[worktree];
  }
  for (const worktree of others) {
    if (worktree in slots) continue;
    const used = new Set(Object.values(slots));
    let slot = 1;
    while (used.has(slot)) slot += 1;
    slots[worktree] = slot;
  }
  return slots;
}

// The variables for one slot, from the config.
export function variablesFor(config, slot) {
  const suffix = slot === 0 ? "" : `_wt${slot}`;
  const step = config.portStep ?? 10;
  const variables = { WORKTREE_SLOT: String(slot) };
  for (const [name, base] of Object.entries(config.ports ?? {})) variables[name] = String(Number(base) + slot * step);
  for (const [name, template] of Object.entries(config.variables ?? {})) {
    variables[name] = String(template).replaceAll("{slot}", String(slot)).replaceAll("{suffix}", suffix);
  }
  return variables;
}

function slotsPath(cwd) {
  const common = git(["rev-parse", "--git-common-dir"], cwd);
  return path.join(path.resolve(cwd, common), slotsFileName);
}

function readSlots(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}

function main() {
  const args = process.argv.slice(2);
  const cwd = process.cwd();
  const config = JSON.parse(readFileSync(configFile, "utf8"));
  const here = realPath(git(["rev-parse", "--show-toplevel"], cwd));
  const file = slotsPath(cwd);
  const slots = assignSlots(listWorktrees(cwd), readSlots(file));

  if (args.includes("--list")) {
    for (const [worktree, slot] of Object.entries(slots)) console.log(`${slot}\t${worktree}`);
    return 0;
  }

  writeFileSync(file, `${JSON.stringify(slots, null, 2)}\n`, "utf8");
  const slot = slots[here];
  if (slot === undefined) throw new Error(`git does not list ${here} as a worktree.`);

  const variables = variablesFor(config, slot);
  const body = Object.entries(variables).map(([name, value]) => `${name}=${value}`).join("\n");
  if (args.includes("--print")) {
    console.log(body);
    return 0;
  }

  const output = path.join(here, config.output ?? ".worktree-slot.env");
  writeFileSync(output, `# Written by tools/worktree-slot.mjs for slot ${slot}. Do not commit.\n${body}\n`, "utf8");
  console.log(`Slot ${slot}: wrote ${path.relative(here, output)}\n${body}`);

  const ignore = path.join(here, ".gitignore");
  const ignored = existsSync(ignore) && readFileSync(ignore, "utf8").split("\n").includes(config.output ?? ".worktree-slot.env");
  if (!ignored) console.log(`Add ${config.output ?? ".worktree-slot.env"} to .gitignore.`);
  return 0;
}

function isEntryPoint() {
  try {
    return process.argv[1] !== undefined && realpathSync(process.argv[1]) === realpathSync(scriptFile);
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(`worktree-slot: ${error.message}`);
    process.exitCode = 1;
  }
}
