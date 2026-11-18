// Test helpers: each test gets a throwaway project with installed copies of
// the templates it needs, so scripts that locate the project from their own
// path (harness/gate.mjs, guards/guard.mjs) run exactly as installed.

import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const repoDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const templateDirectory = path.join(repoDirectory, "templates");

const created = [];

export function makeProject(templateFolders = []) {
  const project = realpathSync(mkdtempSync(path.join(os.tmpdir(), "skills-code-kit-test-")));
  created.push(project);
  for (const folder of templateFolders) {
    cpSync(path.join(templateDirectory, folder), path.join(project, folder), { recursive: true });
  }
  return project;
}

export function write(project, file, content) {
  const target = path.join(project, file);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content);
  return target;
}

export function importFrom(project, file) {
  return import(`${pathToFileURL(path.join(project, file)).href}?t=${Date.now()}-${Math.random()}`);
}

export function run(project, script, args = [], input = "", env = {}) {
  const result = spawnSync(process.execPath, [path.join(project, script), ...args], {
    cwd: project,
    input,
    encoding: "utf8",
    env: { ...process.env, HARNESS_GATE: "", ...env },
  });
  return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

export function git(project, ...args) {
  const result = spawnSync("git", args, { cwd: project, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout.trim();
}

export function cleanUp() {
  for (const project of created.splice(0)) rmSync(project, { recursive: true, force: true });
}
