Feature: Context audit
  A developer sees what each agent tool loads from the project before the
  first prompt, and a team holds it to a budget.
  Rules: BR-0001 to BR-0005. Automated in tests/context-audit.test.mjs.

  Scenario: The largest file is named first
    Given a project with ".claude/", a 40,000-character CLAUDE.md, and two skills
    When the developer runs the audit
    Then the Claude Code section lists CLAUDE.md first, then the two skill descriptions
    And the audit exits 1 under the default budget

  Scenario: Each tool counts its own instruction file
    Given a project with CLAUDE.md, AGENTS.md, ".claude/", and ".codex/"
    When the developer runs the audit
    Then the Claude Code total counts CLAUDE.md and not AGENTS.md
    And the Codex total counts AGENTS.md and not CLAUDE.md

  Scenario: Claude Code falls back to AGENTS.md
    Given a project with AGENTS.md, ".claude/", and no CLAUDE file
    When the developer runs the audit
    Then the Claude Code total counts AGENTS.md

  Scenario: Imports and rules load at launch
    Given CLAUDE.md imports "@docs/a.md", which imports "@docs/b.md"
    And ".claude/rules/api.md" has a "paths" field
    When the developer runs the audit
    Then both imported files are in the Claude Code total
    And "api.md" is listed as loaded on demand

  Scenario: Folder-scoped files stay out of totals
    Given "packages/web/AGENTS.md"
    When the developer runs the audit
    Then it is listed under folder-scoped files and no total includes it

  Scenario: Codex would drop instruction text
    Given Codex is detected and AGENTS.md is 40,000 bytes
    When the developer runs the audit
    Then it warns that Codex drops 7,232 bytes and exits 1

  Scenario: Within budget
    Given every total within budget and no Codex drop
    When the developer runs the audit
    Then it exits 0

  Scenario: Servers and hooks are named, not counted
    Given ".mcp.json" with two servers and a SessionStart hook
    When the developer runs the audit
    Then both servers and the hook command are named and the total is unchanged

  Scenario: No tokenizer installed
    Given no js-tiktoken in the project
    When the developer runs the audit
    Then it prints "npm install --save-dev js-tiktoken" and labels counts as estimates

  Scenario: JSON matches the text report
    When the developer runs the audit with "--json"
    Then the output parses and its totals equal the text report's
