# Bug Fix Workflow

A targeted 5-step pipeline for triaging and resolving a reported bug.
Scope stays minimal — this workflow fixes the bug, it does not refactor
around it (per `CLAUDE.md`: no unrequested feature work or cleanup).

## Step 1 — Reproduction

- Read the bug report and restate the expected vs. actual behavior.
- Create a minimal reproduction: a failing test, a script, or a manual
  step sequence that reliably confirms the issue exists.
- Prefer an automated reproduction (a test that currently fails) over a
  manual one when the codebase has a test runner installed
  (`.claude/rules/testing.md`) — it doubles as the seed for the
  regression test in Step 4.
- If the bug cannot be reproduced, stop here and report that rather than
  guessing at a fix.

## Step 2 — Root Cause Analysis

- Trace the code path from the reproduction back to the underlying
  cause — not just the symptom. Use `Read`/`Grep`/`Glob` over the
  relevant `src/features/*`, `src/app`, or `src/lib` code, and check
  RLS policies/migrations if the bug involves cross-tenant data or
  permissions.
- State the root cause explicitly (file/function/line) before moving on.
  If the fix would require touching a public API contract, a database
  schema/constraint, or an RLS policy, flag that now — it triggers the
  approval gate below before Step 3 proceeds.

## Step 3 — Fix Implementation

- Apply the minimal necessary fix for the root cause identified in
  Step 2. Do not bundle refactors, style changes, or unrelated cleanup
  into this fix.
- Follow `.claude/rules/frontend.md` and `.claude/rules/backend.md` for
  any component, styling, API route, validation, or Supabase query work
  the fix touches.

**Human Approval Gate**

- Before applying any fix that changes an existing public API contract
  (response shape, removed/renamed field, route signature) or a database
  schema constraint (column type/nullability, RLS policy, migration),
  pause and present the proposed change to the user for confirmation.
- Do not proceed to Step 4 until the user explicitly approves. If the
  fix doesn't touch either of these, no gate applies — proceed directly.

## Step 4 — Regression Testing

- Write a dedicated regression test that fails without the fix and
  passes with it, named for the behavior it guards
  (e.g. `"should reject booking when seat is already reserved"`, not
  `"test bug 142"`).
- Confirm the fix doesn't break existing behavior: check that tests
  covering adjacent logic still pass.
- Follow `.claude/rules/testing.md` for unit vs. integration placement
  (e.g. an RLS-related bug needs an integration test proving cross-
  tenant access is denied, not a mocked unit test).

## Step 5 — Verification

- Run the full test suite (not just the new regression test).
- Re-run the original reproduction from Step 1 and confirm it now
  produces the expected behavior.
- Run lint and build, per `CLAUDE.md`.
- Report final status: root cause, fix summary, tests added, full suite
  result.

## Execution & logging constraints

- After every step, append a structured entry to
  `.claude/logs/workflow-run.md` with:
  - timestamp (ISO 8601)
  - step name (Reproduction / Root Cause Analysis / Fix Implementation /
    Regression Testing / Verification)
  - agent status (e.g. `confirmed`, `in-progress`, `pending-approval`,
    `pass`, `fail`, `blocked`)
  - a brief summary of what happened
- If the file doesn't exist yet, create it with a `# Workflow Run Log`
  heading before the first entry; otherwise append, don't overwrite.
- Commit messages, if any commits are made as part of this workflow,
  follow `.claude/rules/git-commit.md` (a bug fix is `fix(<scope>): ...`).
