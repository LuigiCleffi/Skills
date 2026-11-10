# Definition of Done

Owned by the Tech Lead and agreed by the team. A task moves to Done, and an item is Done, only when every applicable check holds. Edit this list to fit the project; changes come from retrospectives.

## Every task

- [ ] The change does what the task says and nothing outside it.
- [ ] Relevant tests were written or updated, and they ran and passed. The note says which commands ran.
- [ ] Type checks, lint, and the build ran and passed where the project has them.
- [ ] `review` found no unresolved blocking finding.
- [ ] The code follows the governing ADRs, and any new architectural decision has an ADR approved at G2.
- [ ] No secrets, credentials, or personal data were added to the repository.

## By owner

- [ ] **Dev:** the item's scenarios pass, and UI work meets its `UIUXDecisions.md` acceptance checks.
- [ ] **DBA:** the migration runs forward and back, or the reason it cannot roll back is documented; new queries have the indexes they need.
- [ ] **DevOps:** the pipeline or a dry run passed; any manual step for the user is written down.

## Every item

- [ ] All its tasks are Done.
- [ ] Each acceptance criterion is shown working in the running increment.
- [ ] Records it depends on (spec, domain model, feature files, UI/UX decisions, ADRs) match what was built.
