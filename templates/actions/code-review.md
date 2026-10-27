---
name: code-review
description: "Review the committed diff between HEAD and a fixed point the user names (a commit, branch, tag, main, HEAD~5) on two independent axes, each in its own sub-agent. Standards asks whether the code is built the way this repository and its installed knowledge base say code should be built; Spec asks whether it does what the originating specification asked for. Reports the axes separately, never blends them into one verdict, and cites a rule, heuristic, or spec line for every finding. Use when asked to code review a branch, a PR, work in progress, or anything since X. Does not fix code."
---

# code-review — Standards and Spec Review of a Diff

## Purpose and ownership

Review the diff `<fixed-point>...HEAD` along two axes:

- **Standards — is it built right?** Does the code follow how this repository writes code: its own documented conventions first, then the installed knowledge base (Clean Code, the language library, and the domain libraries the diff touches)?
- **Spec — is it the right thing?** Does the code do what the originating issue or specification asked for, no less, no more?

Each axis runs in its own sub-agent so neither sees the other's reasoning. The report keeps them apart and never ranks one against the other. A change can pass one axis and fail the other: code that follows every convention but implements the wrong thing passes Standards and fails Spec; code that does exactly what the ticket asked but breaks the repository's conventions does the reverse. A blended verdict lets the passing axis hide the failing one.

`code-review` analyzes and reports. It does not change code, tests, specs, or records, and it never comments on, approves, or requests changes on a pull request without the user's confirmation. `dev` owns remediation.

## Skill boundaries

- `review`: the in-workflow review `dev` runs after each slice and on the final task diff, focused on security, correctness, and architecture, and on whether the code honors the product records (`DomainModel.md`, scenarios, `UIUXDecisions.md`).
- `code-review`: a standalone review of a committed diff against a fixed point, on the Standards and Spec axes, with every finding traced to a written rule or a spec line. Use it on any branch or PR, including someone else's, and from a session that did not write the code.
- `tdd`: when nothing is written yet and the user wants it written test-first.
- `dev`: decides how to address the findings, fixes them, and re-runs the checks.

`code-review` does not hunt for every bug. Null paths, races, and off-by-one errors are reported when the knowledge base names them (for example G3 boundary conditions or a JavaScript red flag), not through a separate bug sweep. Security analysis stays with `review`.

## Inputs

- **Fixed point (required).** A ref the diff is measured from. If the user did not give one, ask; do not guess `main`.
- **Spec path (optional).** A specification, checklist, or issue the user points at.
- **Scope hints (optional).** Paths to include or exclude, or the ticket the diff belongs to.

## When to run it

- **Prefer a fresh session.** A review in the session that wrote the code carries every assumption that shaped it. Recommend a clean session when the user asks from the authoring one, and say so in the report when that recommendation was declined.
- **Per ticket or at the end of a branch.** Per ticket keeps the diff small and gives the Spec axis one clear spec. A pass against the branch point catches interactions between tickets that each per-ticket pass misses. When unsure, review per ticket, then run one final pass against the branch point.
- **Commit first.** The three-dot diff measures from the merge-base and excludes staged and working-tree changes. If the work is uncommitted, say so and ask the user to commit (or make a fixup commit) before reviewing.

## Workflow

### 1. Validate the target before spawning anything

Run these checks yourself, in the main session, so a mistyped ref fails in front of the user instead of inside two sub-agents:

1. `git rev-parse --verify --quiet "<fixed-point>^{commit}"` — the ref resolves. If it fails, stop and report the ref that did not resolve.
2. `git diff --quiet "<fixed-point>...HEAD"` — the diff is not empty (exit code 1 means there are changes). If it is empty, stop and say there is nothing to review between the two points.
3. `git status --porcelain` — note uncommitted changes, which the review will not see.
4. `git diff --stat "<fixed-point>...HEAD"` and `git log --format='%h %s%n%b' "<fixed-point>..HEAD"` — the changed files and the commit messages, which both axes need.

### 2. Find the spec

Look in this order and stop at the first that yields a spec:

1. **Issue references in the commit messages** (`#123`, `Closes #45`, a GitLab `!67`). Fetch them with the tracker the project uses (`gh issue view`, `glab`, or a connected tracker tool). If the tracker is not reachable, record the references and continue down the list.
2. **A path the user passed in.**
3. **The product records for the feature**, matched by branch or feature name: `SpecifyRequirements.md` and its `spec-checklist` result, plus the records written next to it when they exist — `DomainModel.md` and the glossary from `ddd`, feature files from `bdd`, `UIUXDecisions.md` from `uiux`, and `StrategyBrief.md` from `strategy`. Also check `docs/`, `specs/`, and `.scratch/`.
4. **Ask the user.**

If no spec exists, skip the Spec sub-agent. The Spec block then says `No spec available` and lists where you looked. Never infer requirements from the code and review the code against them.

### 3. Pick the Standards sources

The repository always overrides the knowledge base. Collect, in this order of precedence:

1. **The repository's documented standards:** `CODING_STANDARDS.md`, `CONTRIBUTING.md`, style guides, architecture decision records, and conventions stated in `AGENTS.md` or `CLAUDE.md`.
2. **Linter, formatter, and type-checker configuration.** These define what the axis skips: never report what a configured tool already enforces.
3. **The installed knowledge base**, read only for what the diff touches:

| The diff touches | Read |
|---|---|
| Any code (the smell baseline) | `CleanCode/SmellsAndHeuristics/smellsReview.md` and `heuristicsCatalog.md`, plus the chapter skill a finding points to, as routed by `CleanCode/README.md` |
| Tests | `CleanCode/UnitTests/unitTests.md`; `TDD/Patterns/MasteringTDD/masteringTDD.md` when `TDD/README.md` is installed |
| Feature files, step definitions, acceptance-test glue | The skills `BDD/README.md` routes to for writing and automating scenarios |
| Domain layer, aggregates, repositories, context boundaries | The building-block and strategic-design skills `DDD/README.md` routes to |
| JavaScript or TypeScript | The "Red flags" of the language skills `JavaScript/README.md` routes to |
| Prompts, retrieval, agents, fine-tuning, model data or deployment | The "Red flags" of the skills `LLM/README.md` routes to |
| SQL, migrations, schema | The folder `DBA/README.md` routes to for the project's engine only |
| Storage, replication, partitioning, transactions, pipelines | The chapter skills `DataSystems/README.md` routes to |
| CI/CD, infrastructure as code, deployment, monitoring | `DevOps/Practices/` plus only the platform folder `DevOps/README.md` routes to |
| UI components, accessibility, copy, UI tests | The skills `UIUX/README.md` routes to for those concerns |

Skip a row when its library is not installed. Do not read whole libraries; read the skills that match the changed hunks.

### 4. Run the two sub-agents

Spawn both in parallel, each with its brief below and nothing from the other. Pass each the fixed point, the changed-file list, and the commit messages. Pass the Standards agent the sources from step 3; pass the Spec agent the spec from step 2. Do not pass either your own impressions of the diff.

Append this line to both briefs, verbatim: **"Do not invoke code-review or spawn additional agents: perform this review directly."** Without it a sub-agent can rediscover this skill and fan out again.

If the runtime cannot spawn sub-agents, run the Standards axis first and write its findings down before opening the spec, then run the Spec axis. Say in the report that the axes ran in one context.

#### Standards brief

> Review `git diff <fixed-point>...HEAD` for whether the code is built the way this repository says code should be built. Read the sources listed below, in order of precedence; the repository's own documents override the knowledge base. Do not report anything a configured linter, formatter, or type checker enforces.
>
> Report two kinds of finding:
> - **Breach:** the change contradicts a rule written in one of the repository's own files. Cite the file and quote the rule.
> - **Smell:** the change matches a heuristic in the knowledge base. Always a judgement call: label it "possible" (for example `possible G14 Feature Envy`), cite the skill path and the heuristic code or red flag, and give the fix the skill describes.
>
> Every finding quotes the hunk it is about, with `path:line`. Follow the calibration in `smellsReview.md`: flag what actually hurts the reader or the next change, report one root cause under one code, and follow the language's idiom over a dated heuristic. Report only problems introduced by this diff. Do not modify any file.

#### Spec brief

> Review `git diff <fixed-point>...HEAD` for whether it does what the specification below asks. Do not judge style or conventions. Walk the requirements (`FR-`, `SC-`, `REQ-` items, checklist items, acceptance scenarios) and the recorded decisions (`DM-` invariants and glossary terms, `UX-` decisions, `STR-` items, Gherkin scenarios) that apply to this diff.
>
> Report each finding as one of:
> - **Missing:** a requirement in scope has no implementation in the diff.
> - **Partial:** implemented for some cases, paths, or states but not all the spec names.
> - **Wrong:** implemented, but the behavior differs from what the spec says.
> - **Contradicts a decision:** the code departs from a recorded domain, scenario, UI/UX, or strategy decision (for example a name that is not the glossary term, an invariant enforced outside its aggregate, a state from `UIUXDecisions.md` left out).
> - **Scope creep:** behavior no requirement asks for.
>
> Every finding quotes the spec line with its ID and points to the `path:line` in the diff, or states that no code implements it. You may run targeted, non-destructive tests; report only results you observed. Requirements outside this diff's scope are not findings. Do not modify any file.

### 5. Check the citations

Sub-agent output is a hypothesis, not evidence. Before writing the report, check every finding:

- The quoted hunk exists in the diff at the cited location.
- The cited rule, heuristic code, or spec line exists in the cited file and says what the finding claims.
- The finding is about code this diff introduced or changed.

Fix a wrong location you can resolve. Drop a finding whose citation does not hold, and count it in the coverage notes. Do not re-rank, merge, or reword findings across axes.

### 6. Report

Use the output format below. Return the report in chat. If the user wants it posted on the PR, show them the exact comment first and post only after they confirm.

## Finding format

Follow the severity scale of `actions/review.md` when it is installed (Critical, High, Medium, Low, Informational); otherwise use High, Medium, Low. Each finding:

- `[Severity] Kind — short title` (Kind is Breach or Smell on Standards; Missing, Partial, Wrong, Contradicts a decision, or Scope creep on Spec)
- **Location:** `path/to/file.ext:line-line`
- **Hunk:** the quoted code
- **Cites:** the rule and its file, the heuristic code and its skill, or the spec line and its ID
- **Why it matters:** the concrete cost to this code
- **Fix:** the change the rule, skill, or spec points to

## Output format

```markdown
## Standards

Sources: <repository files read>; knowledge base: <skills read>; skipped as tool-enforced: <linters/formatters>.

<findings, Breaches before Smells, each ordered by severity>
or: No Standards findings in the reviewed diff.

## Spec

Spec: <issue, path, or records used>.

<findings ordered by severity>
or: No Spec findings in the reviewed diff.
or: No spec available. Looked in: <commit references, argument, records, docs/specs/.scratch>.

## Summary

- **Worst Standards issue:** <one line, or none>
- **Worst Spec issue:** <one line, or none, or no spec available>

The axes are reported separately and not ranked against each other.

## Coverage

- Diff: `<fixed-point>...HEAD`, <n> files, <commits>.
- Not seen: <uncommitted changes, if any>.
- Checks run: <commands and observed results>, or none.
- Dropped in citation check: <count and reason>.
- Context: <fresh session | authoring session | axes ran in one context>.
```

## Repeated runs

Each fix adds new code, and the Smell half of the Standards axis varies between runs, so a rerun always finds something. Treat a pass as a list of leads: act on the Breaches, the Spec findings, and the Smells whose cost is clear, then stop. Do not rerun until it comes back clean.

When reviews keep catching the same class of mistake, propose a rule for the repository's own standards file so the next Standards pass reads it as a Breach instead of rediscovering it as a Smell. The user decides whether to add it.

## Guardrails

- Never start without a resolved fixed point and a non-empty diff.
- Never modify code, tests, specs, or product records during the review.
- Never invent requirements when no spec exists.
- Never report a finding without a citation, or a Smell as a hard violation.
- Never merge the two axes into one verdict or name an overall winner.
- Never claim a test or check ran unless its result was observed.
- Never comment on, approve, or request changes on a pull request without the user's confirmation.
- Do not expose secrets found in the diff; describe their location and type.
