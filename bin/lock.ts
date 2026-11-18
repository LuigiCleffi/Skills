// The install lock: .skills-code-kit/lock.json records the sha256 of every
// file the installer wrote. With it, a rerun updates the files nobody changed
// without asking, asks only about the files someone edited, and
// `skills-code-kit verify` reports installed files that changed since.

import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const lockFile = ".skills-code-kit/lock.json";

export type Lock = { version: string; files: Record<string, string> };

// new: not in the project · same: already what would be installed ·
// untouched: unchanged since the last install, safe to update ·
// modified: changed by someone, or installed before the lock existed.
export type FileState = "new" | "same" | "untouched" | "modified";

export function hashContent(content: Buffer | string): string {
  return createHash("sha256").update(content).digest("hex");
}

export async function hashFile(file: string): Promise<string | null> {
  try {
    return hashContent(await readFile(file));
  } catch {
    return null;
  }
}

export async function readLock(projectDirectory: string): Promise<Lock | null> {
  try {
    const lock = JSON.parse(await readFile(path.join(projectDirectory, lockFile), "utf8")) as Lock;
    return lock && typeof lock.files === "object" ? lock : null;
  } catch {
    return null;
  }
}

export async function writeLock(projectDirectory: string, lock: Lock): Promise<void> {
  const sorted = Object.fromEntries(Object.entries(lock.files).sort(([a], [b]) => a.localeCompare(b)));
  await mkdir(path.join(projectDirectory, path.dirname(lockFile)), { recursive: true });
  await writeFile(
    path.join(projectDirectory, lockFile),
    `${JSON.stringify({ version: lock.version, files: sorted }, null, 2)}\n`,
    "utf8",
  );
}

export function classify(current: string | null, locked: string | undefined, incoming: string): FileState {
  if (current === null) return "new";
  if (current === incoming) return "same";
  if (locked !== undefined && current === locked) return "untouched";
  return "modified";
}

export type VerifyReport = { missing: string[]; modified: string[]; outdated: string[]; checked: number };

// Compares the project with its lock and, where a template exists, with the
// templates of the running package version.
export async function verifyProject(
  projectDirectory: string,
  templateDirectory: string,
): Promise<VerifyReport | null> {
  const lock = await readLock(projectDirectory);
  if (!lock) return null;

  const report: VerifyReport = { missing: [], modified: [], outdated: [], checked: 0 };

  for (const [file, locked] of Object.entries(lock.files)) {
    report.checked += 1;
    const current = await hashFile(path.join(projectDirectory, file));
    if (current === null) {
      report.missing.push(file);
      continue;
    }
    if (current !== locked) report.modified.push(file);
    const template = await hashFile(path.join(templateDirectory, file));
    if (template !== null && template !== locked) report.outdated.push(file);
  }

  return report;
}
