#!/usr/bin/env node
//
// Doctor: checks that this machine can work on the project, and says how to
// fix what is missing. It only reads: it never installs, logs in, or changes
// a file, so anyone can run it without fear.
//
// The checks live in tools/doctor.json. Each one is a command that must
// succeed (and whose output may have to match "expect") or a path that must
// exist, with "fix" (a command the person runs) or "ask" (what to request
// from someone else, ready to send), and "optional" for what only some tasks
// need.
//
// Usage: node tools/doctor.mjs           # a list for a person
//        node tools/doctor.mjs --json    # the same, for an agent
// Exit 1 when a required check fails, 2 when it cannot run (doctor.json missing
// or broken).

import { execSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptFile = fileURLToPath(import.meta.url);
const projectDirectory = path.resolve(path.dirname(scriptFile), "..");

export function runCheck(check, cwd = projectDirectory, exec = execSync) {
  if (check.exists) {
    return { ok: existsSync(path.resolve(cwd, check.exists)), detail: check.exists };
  }
  try {
    const output = String(exec(check.run, { cwd, encoding: "utf8", timeout: 15000, stdio: ["ignore", "pipe", "pipe"] })).trim();
    const ok = check.expect ? new RegExp(check.expect, "m").test(output) : true;
    return { ok, detail: output.split("\n")[0].slice(0, 120) };
  } catch (error) {
    return { ok: false, detail: String(error.stderr || error.message || "").split("\n")[0].slice(0, 120) };
  }
}

export function report(config, cwd = projectDirectory, exec = execSync) {
  return (config.checks ?? []).map((check) => ({ ...check, ...runCheck(check, cwd, exec) }));
}

function main() {
  const config = JSON.parse(readFileSync(path.join(path.dirname(scriptFile), "doctor.json"), "utf8"));
  const results = report(config);
  const failedRequired = results.filter((result) => !result.ok && !result.optional);

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(results.map(({ name, ok, optional, fix, ask, detail }) => ({ name, ok, optional: Boolean(optional), fix, ask, detail })), null, 2));
  } else {
    for (const result of results) {
      const mark = result.ok ? "✓" : result.optional ? "–" : "✗";
      console.log(`${mark} ${result.name}${result.ok ? "" : result.optional ? " (only needed for some tasks)" : ""}`);
      if (!result.ok && result.fix) console.log(`    fix: ${result.fix}`);
      if (!result.ok && result.ask) console.log(`    ask: ${result.ask}`);
    }
    console.log(failedRequired.length === 0 ? "\nReady to work." : `\n${failedRequired.length} thing(s) to fix before working.`);
  }
  return failedRequired.length === 0 ? 0 : 1;
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
    console.error(`doctor: ${error.message}`);
    process.exitCode = 2; // Exit 1 means the check failed; 2 means it could not run.
  }
}
