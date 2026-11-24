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
//   node tools/worktree-slot.mjs --hook    # as a SessionStart hook: one line for the agent, never fails
//   node tools/worktree-slot.mjs --orphans [--yes]   # slots of removed worktrees, and their cleanup
//
// In tools/worktree.json, "include" names a file in the main checkout that
// lists untracked files a new worktree needs (.env.local, say), copied when
// missing; "linkDependencies" lists folders (node_modules) linked from the
// main checkout instead of installed again. Ports never land on a port
// browsers refuse or on macOS's AirPlay ports (5000, 7000).
//
// It does not create databases or start anything: create the database named
// in the file with the project's own tool. Exit 2 when it cannot run (outside
// git); --hook exits 0 then. No dependencies beyond Node.js 20.

import { execFileSync, execSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
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

// Ports browsers refuse to open (the Fetch standard's "bad ports"), and 5000
// and 7000, which macOS gives to AirPlay. A slot's port never lands on one.
const unusablePorts = new Set([
  1, 7, 9, 11, 13, 15, 17, 19, 20, 21, 22, 23, 25, 37, 42, 43, 53, 69, 77, 79, 87, 95, 101, 102, 103, 104, 109, 110,
  111, 113, 115, 117, 119, 123, 135, 137, 139, 143, 161, 179, 389, 427, 465, 512, 513, 514, 515, 526, 530, 531, 532,
  540, 548, 554, 556, 563, 587, 601, 636, 989, 990, 993, 995, 1719, 1720, 1723, 2049, 3659, 4045, 4190, 5000, 5060,
  5061, 6000, 6566, 6665, 6666, 6667, 6668, 6669, 6679, 6697, 7000, 10080,
]);

// The port for a slot: base + slot * step, moved up within the slot's own
// block when it lands on an unusable port, so it never meets another slot's.
export function portFor(base, slot, step) {
  const start = Number(base) + slot * step;
  for (let port = start; port < start + step; port += 1) {
    if (!unusablePorts.has(port)) return port;
  }
  return start;
}

// The variables for one slot, from the config.
export function variablesFor(config, slot) {
  const suffix = slot === 0 ? "" : `_wt${slot}`;
  const step = config.portStep ?? 10;
  const variables = { WORKTREE_SLOT: String(slot) };
  for (const [name, base] of Object.entries(config.ports ?? {})) variables[name] = String(portFor(base, slot, step));
  for (const [name, template] of Object.entries(config.variables ?? {})) {
    variables[name] = String(template).replaceAll("{slot}", String(slot)).replaceAll("{suffix}", suffix);
  }
  return variables;
}

// Slots whose worktree is gone (removed by hand, or by another tool) leave
// their resources behind: a database named app_wt2 keeps its data, and the
// next worktree given slot 2 would inherit it. They are kept here until
// cleaned up with --orphans.
export function findOrphans(previous, current, config) {
  const orphans = {};
  for (const [worktree, slot] of Object.entries(previous)) {
    if (!(worktree in current) && Number.isInteger(slot) && slot > 0) orphans[worktree] = { slot, variables: variablesFor(config, slot) };
  }
  return orphans;
}

export function cleanupCommand(template, variables) {
  return template.replace(/\{(\w+)\}/g, (match, name) => variables[name] ?? match);
}

function orphansPath(cwd) {
  return slotsPath(cwd).replace(/slots\.json$/, "orphans.json");
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

// The untracked files a fresh worktree needs from the main checkout (local
// env files, say), listed one per line in the include file; "*" matches
// within one folder. Copied only when missing here: never overwritten.
export function provisionFiles(main, here, includeFile) {
  const list = path.join(main, includeFile);
  if (main === here || !existsSync(list)) return [];
  const copied = [];
  for (const raw of readFileSync(list, "utf8").split("\n")) {
    const entry = raw.trim();
    if (!entry || entry.startsWith("#")) continue;
    const folder = path.dirname(entry);
    const name = path.basename(entry);
    const pattern = new RegExp(`^${name.replace(/[.+^${}()|[\]\\]/g, "\\$&").replaceAll("*", "[^/]*")}$`);
    let names = [];
    try {
      names = name.includes("*") ? readdirSync(path.join(main, folder)).filter((file) => pattern.test(file)) : [name];
    } catch {
      continue;
    }
    for (const file of names) {
      const relative = path.join(folder, file);
      const source = path.join(main, relative);
      const target = path.join(here, relative);
      if (!existsSync(source) || existsSync(target)) continue;
      mkdirSync(path.dirname(target), { recursive: true });
      copyFileSync(source, target);
      copied.push(relative);
    }
  }
  return copied;
}

// Folders shared from the main checkout by a link (node_modules, say), so a
// new worktree runs without a fresh install. Opt-in: a dependency change on
// the worktree's branch then needs its own install.
export function linkDependencies(main, here, folders = []) {
  const linked = [];
  if (main === here) return linked;
  for (const folder of folders) {
    const source = path.join(main, folder);
    const target = path.join(here, folder);
    if (!existsSync(source) || existsSync(target)) continue;
    symlinkSync(source, target, "dir");
    linked.push(folder);
  }
  return linked;
}

function main() {
  const args = process.argv.slice(2);
  const cwd = process.cwd();
  const config = JSON.parse(readFileSync(configFile, "utf8"));
  const here = realPath(git(["rev-parse", "--show-toplevel"], cwd));
  const file = slotsPath(cwd);
  const previous = readSlots(file);
  const slots = assignSlots(listWorktrees(cwd), previous);
  const orphanFile = orphansPath(cwd);
  const orphans = { ...readSlots(orphanFile), ...findOrphans(previous, slots, config) };
  writeFileSync(orphanFile, `${JSON.stringify(orphans, null, 2)}\n`, "utf8");

  if (args.includes("--orphans")) {
    const entries = Object.entries(orphans);
    if (entries.length === 0) {
      console.log("No orphaned slots.");
      return 0;
    }
    const template = config.cleanup;
    for (const [worktree, orphan] of entries) {
      const command = template ? cleanupCommand(template, orphan.variables) : null;
      console.log(`slot ${orphan.slot} (was ${worktree}): ${Object.entries(orphan.variables).filter(([name]) => name !== "WORKTREE_SLOT").map(([name, value]) => `${name}=${value}`).join(", ")}${command ? `\n    cleanup: ${command}` : ""}`);
    }
    if (!template) {
      console.log('\nSet "cleanup" in tools/worktree.json (for example "dropdb --if-exists {DATABASE_NAME}") to clean these up with --yes.');
      return 0;
    }
    if (!args.includes("--yes")) {
      console.log("\nDry run. Run again with --yes to run the cleanup commands above.");
      return 0;
    }
    for (const [worktree, orphan] of entries) {
      execSync(cleanupCommand(template, orphan.variables), { stdio: "inherit" });
      delete orphans[worktree];
      writeFileSync(orphanFile, `${JSON.stringify(orphans, null, 2)}\n`, "utf8");
    }
    console.log("Cleaned up.");
    return 0;
  }

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

  const inherited = Object.values(orphans).find((orphan) => orphan.slot === slot && slot > 0);
  const warning = inherited
    ? `Slot ${slot} still has resources from a removed worktree (${Object.entries(inherited.variables).filter(([name]) => name !== "WORKTREE_SLOT").map(([name, value]) => `${name}=${value}`).join(", ")}); clean them up first: node tools/worktree-slot.mjs --orphans`
    : null;

  const output = path.join(here, config.output ?? ".worktree-slot.env");
  writeFileSync(output, `# Written by tools/worktree-slot.mjs for slot ${slot}. Do not commit.\n${body}\n`, "utf8");
  const mainCheckout = listWorktrees(cwd)[0];
  const copied = config.include ? provisionFiles(mainCheckout, here, config.include) : [];
  const linked = linkDependencies(mainCheckout, here, config.linkDependencies ?? []);

  // As a session hook, one short line the agent reads: where to run the app.
  if (args.includes("--hook")) {
    const extras = [copied.length ? `copied ${copied.join(", ")}` : "", linked.length ? `linked ${linked.join(", ")}` : ""].filter(Boolean);
    if (warning) console.log(warning);
    console.log(`Worktree slot ${slot}: ${Object.entries(variables).filter(([name]) => name !== "WORKTREE_SLOT").map(([name, value]) => `${name}=${value}`).join(", ")} (in ${path.relative(here, output)})${extras.length ? `; ${extras.join("; ")}` : ""}.`);
    return 0;
  }

  console.log(`Slot ${slot}: wrote ${path.relative(here, output)}\n${body}`);
  if (warning) console.log(warning);
  if (copied.length > 0) console.log(`Copied from the main checkout: ${copied.join(", ")}`);
  if (linked.length > 0) console.log(`Linked from the main checkout: ${linked.join(", ")}`);

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
    // As a session hook it never stops the session: outside git, it says nothing.
    if (process.argv.includes("--hook")) {
      process.exitCode = 0;
    } else {
      console.error(`worktree-slot: ${error.message}`);
      process.exitCode = 2;
    }
  }
}
