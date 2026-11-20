#!/usr/bin/env node
//
// Cycle metrics: the numbers of a sprint or any window, defined once, so this
// cycle compares with the last one without anyone re-deciding what a number
// means. Reads git and GitHub (through the gh CLI) only; it never writes.
//
// Usage:
//   node tools/cycle-metrics.mjs                          # the last 14 days and the 14 before
//   node tools/cycle-metrics.mjs --since 2026-11-03 --until 2026-11-16
//   node tools/cycle-metrics.mjs --markdown               # a table for the review, instead of JSON
//
// Definitions (UTC days, both ends included):
//   merged            pull requests merged in the window
//   hoursToMerge      opened -> merged, median and 90th percentile
//   firstLookHours    opened -> first review or comment by someone other than the author (bots excluded), median
//   noLookShare       share of merged pull requests nobody else looked at before the merge
//   sizeMedian        lines added + deleted per merged pull request, median
//   largeShare        share of merged pull requests over 400 changed lines
//   ciFailureShare    failed runs / finished runs (success, failure, cancelled, timed out)
//   reverts           commits on the default branch whose subject starts with "Revert"
//   releases          tags created in the window
//   escapedDefects    fix runs recorded as escaped in docs/harness/runs/ (when the harness is installed)
//
// A number whose source cannot be read is null, and "missing" says why. It is
// never estimated. No dependencies beyond Node.js 20, git, and gh.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptFile = fileURLToPath(import.meta.url);
const largeLines = 400;
const day = 24 * 60 * 60 * 1000;

const isBot = (login) => !login || /\[bot\]$|^(dependabot|renovate|github-actions)/i.test(login);

// Linear interpolation between the closest ranks; null for an empty list.
export function percentile(values, p) {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const rank = (sorted.length - 1) * p;
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  return sorted[low] + (sorted[high] - sorted[low]) * (rank - low);
}

const round = (value, digits = 1) => (value === null ? null : Number(value.toFixed(digits)));
const hoursBetween = (from, to) => (Date.parse(to) - Date.parse(from)) / 3_600_000;

// The window [since, until] and the previous window of the same length.
export function windows(since, until) {
  const start = Date.parse(`${since}T00:00:00Z`);
  const end = Date.parse(`${until}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) throw new Error("--since and --until must be dates, since first");
  const length = Math.round((end - start) / day) + 1;
  const iso = (time) => new Date(time).toISOString().slice(0, 10);
  return {
    current: { since: iso(start), until: iso(end), days: length },
    previous: { since: iso(start - length * day), until: iso(start - day), days: length },
  };
}

// The first review or comment by someone other than the author, before the merge.
export function firstLookAt(pr) {
  const author = pr.author?.login;
  const looks = [
    ...(pr.reviews ?? []).map((review) => ({ login: review.author?.login, bot: review.author?.is_bot, at: review.submittedAt })),
    ...(pr.comments ?? []).map((comment) => ({ login: comment.author?.login, bot: comment.author?.is_bot, at: comment.createdAt })),
  ]
    // gh drops the "[bot]" suffix from bot logins, so its is_bot flag counts too.
    .filter((look) => look.at && look.login !== author && !look.bot && !isBot(look.login) && (!pr.mergedAt || look.at <= pr.mergedAt));
  return looks.map((look) => look.at).sort()[0] ?? null;
}

export function prMetrics(prs) {
  const merged = prs.filter((pr) => pr.mergedAt);
  const toMerge = merged.map((pr) => hoursBetween(pr.createdAt, pr.mergedAt));
  const looks = merged.map((pr) => ({ pr, at: firstLookAt(pr) }));
  const firstLook = looks.filter((look) => look.at).map((look) => hoursBetween(look.pr.createdAt, look.at));
  const sizes = merged.map((pr) => (pr.additions ?? 0) + (pr.deletions ?? 0));
  const share = (count) => (merged.length === 0 ? null : round(count / merged.length, 2));
  return {
    merged: merged.length,
    hoursToMergeMedian: round(percentile(toMerge, 0.5)),
    hoursToMergeP90: round(percentile(toMerge, 0.9)),
    firstLookHoursMedian: round(percentile(firstLook, 0.5)),
    noLookShare: share(looks.filter((look) => !look.at).length),
    sizeMedian: round(percentile(sizes, 0.5), 0),
    largeShare: share(sizes.filter((size) => size > largeLines).length),
  };
}

// Failed runs over finished runs; a cancelled or timed-out run counts as finished.
export function ciFailureShare(runs) {
  const finished = runs.filter((run) => ["success", "failure", "cancelled", "timed_out"].includes(run.conclusion));
  if (finished.length === 0) return null;
  return round(finished.filter((run) => run.conclusion === "failure" || run.conclusion === "timed_out").length / finished.length, 2);
}

// Fix runs recorded as escaped whose record opened inside the window.
export function escapedDefects(runsDirectory, window) {
  if (!existsSync(runsDirectory)) return null;
  let count = 0;
  for (const name of readdirSync(runsDirectory).filter((file) => file.endsWith(".md"))) {
    const document = readFileSync(path.join(runsDirectory, name), "utf8");
    const opened = /^\*\*Opened:\*\*\s*(\d{4}-\d{2}-\d{2})/m.exec(document)?.[1];
    if (opened && opened >= window.since && opened <= window.until && /^\*\*Escaped:\*\*\s*yes/im.test(document)) count += 1;
  }
  return count;
}

function run(command, args) {
  return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 });
}

function collect(window, missing) {
  const range = `${window.since}..${window.until}`;
  const metrics = {};

  try {
    const prs = JSON.parse(run("gh", [
      "pr", "list", "--state", "merged", "--search", `merged:${range}`, "--limit", "1000",
      "--json", "number,author,createdAt,mergedAt,additions,deletions,reviews,comments",
    ]));
    Object.assign(metrics, prMetrics(prs));
    if (prs.length === 1000) missing.push(`pull requests ${range}: 1000 or more, only the first 1000 counted`);
  } catch (error) {
    Object.assign(metrics, prMetrics([]), { merged: null });
    missing.push(`pull requests ${range}: ${error.message.split("\n")[0]}`);
  }

  try {
    metrics.ciFailureShare = ciFailureShare(JSON.parse(run("gh", ["run", "list", "--created", range, "--limit", "1000", "--json", "conclusion"])));
  } catch (error) {
    metrics.ciFailureShare = null;
    missing.push(`CI runs ${range}: ${error.message.split("\n")[0]}`);
  }

  try {
    const after = `${window.since}T00:00:00Z`;
    const before = `${window.until}T23:59:59Z`;
    metrics.reverts = run("git", ["log", "--first-parent", `--since=${after}`, `--until=${before}`, "--format=%s"])
      .split("\n").filter((subject) => /^Revert\b/.test(subject)).length;
    metrics.releases = run("git", ["for-each-ref", "refs/tags", "--format=%(creatordate:short)"])
      .split("\n").filter((date) => date >= window.since && date <= window.until).length;
  } catch (error) {
    metrics.reverts = null;
    metrics.releases = null;
    missing.push(`git ${range}: ${error.message.split("\n")[0]}`);
  }

  metrics.escapedDefects = escapedDefects(path.join(process.cwd(), "docs/harness/runs"), window);
  return metrics;
}

const labels = {
  merged: "Pull requests merged",
  hoursToMergeMedian: "Hours to merge, median",
  hoursToMergeP90: "Hours to merge, slowest 10%",
  firstLookHoursMedian: "Hours to a first look, median",
  noLookShare: "Merged with no one else looking",
  sizeMedian: "Changed lines per pull request, median",
  largeShare: `Pull requests over ${largeLines} lines`,
  ciFailureShare: "CI runs that failed",
  reverts: "Reverts",
  releases: "Releases",
  escapedDefects: "Escaped defects",
};

export function markdownTable(report) {
  const show = (value, key) => (value === null || value === undefined ? "n/a" : key.endsWith("Share") ? `${Math.round(value * 100)}%` : String(value));
  const lines = [
    `| Metric | ${report.window.since} to ${report.window.until} | ${report.previousWindow.since} to ${report.previousWindow.until} |`,
    "|---|---|---|",
    ...Object.keys(labels).map((key) => `| ${labels[key]} | ${show(report.metrics[key], key)} | ${show(report.previousMetrics[key], key)} |`),
  ];
  if (report.missing.length > 0) lines.push("", "Not read:", ...report.missing.map((item) => `- ${item}`));
  return lines.join("\n");
}

function option(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

function main() {
  const args = process.argv.slice(2);
  const today = new Date().toISOString().slice(0, 10);
  const until = option(args, "--until") ?? today;
  const since = option(args, "--since") ?? new Date(Date.parse(`${until}T00:00:00Z`) - 13 * day).toISOString().slice(0, 10);
  const { current, previous } = windows(since, until);
  const missing = [];
  const report = {
    window: current,
    previousWindow: previous,
    metrics: collect(current, missing),
    previousMetrics: collect(previous, missing),
    missing,
  };
  console.log(args.includes("--markdown") ? markdownTable(report) : JSON.stringify(report, null, 2));
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
    console.error(`cycle-metrics: ${error.message}`);
    process.exitCode = 1;
  }
}
