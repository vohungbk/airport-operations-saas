# Feature Development Workflow

A strict, sequential 4-step pipeline for implementing a new feature or a
non-trivial change. Each step maps to an existing project agent — see
`.claude/agents/*.md` for that agent's full rules. Do not skip a step,
and do not run steps out of order.

## Step 1 — Planning (`planner` agent)

- Read the user's requirement and restate it, including what is
  explicitly out of scope.
- Inspect the codebase (`src/features/*`, `src/app`, `src/lib`,
  `src/components`) and project docs (`CLAUDE.md`, `docs/*`) to ground
  the plan in what actually exists.
- Break the work into an ordered, dependency-aware task list. For each
  task: what it changes, roughly which files/modules, dependencies on
  other tasks, and any decision the dev agent should not make alone.
- Identify which modified/created files are affected, and flag anything
  that looks like a breaking change, database migration, or security-
  sensitive modification (RLS policy, service-role usage, auth/RBAC).
- Export the full plan to `plan.md` at the repo root.

**MANDATORY HUMAN APPROVAL GATE**

- Stop immediately after writing `plan.md`. Do not touch any source
  file, run any command, or invoke any other agent past this point.
- Present `plan.md` to the user and explicitly ask them to approve or
  reject it.
- Do not proceed to Step 2 under any circumstance until the user gives
  explicit approval (e.g. "approved", "looks good, go ahead"). A
  non-committal reply, silence, or moving on to a different topic is
  not approval — ask again.
- If rejected, revise `plan.md` per the user's feedback and re-present it
  for approval. Do not proceed on a partial or conditional approval —
  confirm the revised plan is acceptable first.
- Log the gate outcome (pending / approved / rejected + reason) to
  `.claude/logs/workflow-run.md` per the logging format below.

## Step 2 — Implementation (`dev` agent)

- Implement strictly according to the approved `plan.md`. Do not expand
  scope beyond what was approved — if the plan turns out to be wrong or
  incomplete mid-implementation, stop and surface it rather than
  improvising past what was approved.
- Follow `.claude/rules/frontend.md` and `.claude/rules/backend.md` for
  all component, styling, state-management, API route, validation, and
  Supabase query conventions.
- Invoke the `api-integration` skill whenever the plan requires creating
  or changing a Route Handler / API endpoint.
- Run lint and build after significant changes, per `CLAUDE.md`.

## Step 3 — Code Review (`reviewer` agent)

- Review the diff produced in Step 2 against the `code-review-checklist`
  skill (naming, error handling, security — RLS/service-role keys/
  secrets/tenant isolation, N+1 queries, test coverage) and against
  `CLAUDE.md` / `.claude/rules/*.md`.
- The reviewer is read-only: it reports findings, it never edits code.

**Loop mechanism**

- If the review finds failing items, route back to Step 2 with the
  specific, actionable feedback (file, issue, what to change) — do not
  just say "fix the review comments."
- Repeat Step 2 → Step 3 until the reviewer reports no outstanding
  findings.
- Log each review iteration (pass/fail + summary of findings) to
  `.claude/logs/workflow-run.md`.

## Step 4 — Quality Assurance (`qa` agent)

- Write and execute automated tests for the change, following
  `.claude/rules/testing.md`: unit tests for pure logic/schemas, and
  integration tests for Server Actions/Route Handlers, RLS policies, and
  auth/RBAC-gated flows.
- Minimum bar per `testing.md`: happy path + validation-failure path for
  every new/changed Server Action or Route Handler, a cross-tenant-denial
  test for every new/changed RLS policy, and happy path + two edge cases
  for the feature overall.
- If no test runner is installed yet, do not silently add one — report
  this and stop for user direction, per `.claude/agents/qa.md`.
- Report pass/fail results and any coverage gaps.

## Execution & logging constraints

- After every step, append an entry to `.claude/logs/workflow-run.md`
  with:
  - timestamp (ISO 8601)
  - step name (Planning / Implementation / Code Review / QA)
  - agent status (e.g. `pending-approval`, `in-progress`, `pass`,
    `fail`, `blocked`)
  - a brief summary of what happened
- If the file doesn't exist yet, create it with a `# Workflow Run Log`
  heading before the first entry; otherwise append, don't overwrite.
- **Pause and ask for user approval** — outside the Step 1 gate — the
  moment any of the following is detected at any step, even if it wasn't
  called out in the approved plan:
  - a breaking change (removed/changed public API contract, changed
    response shape, removed prop)
  - a database migration or schema change
  - a security-risk modification (new/changed RLS policy, anything
    touching service-role keys, auth/RBAC logic)
- Commit messages, if any commits are made as part of this workflow,
  follow `.claude/rules/git-commit.md`.
