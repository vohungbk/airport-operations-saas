# Testing Rules

Current state: no test runner is installed yet (`package.json` only has
a `lint` script). Don't assume a test command exists — check
`package.json` first, and don't unilaterally install a test framework;
that's a decision for the team or an explicit task (see the `qa` agent in
`.claude/agents/qa.md`). The rules below apply once tests exist, and
should shape what gets set up when they do.

## Unit tests vs. integration tests

**Write a unit test when** the thing under test is pure logic that can be
isolated from I/O:
- Business logic in `src/lib` or a feature module — booking state-machine
  transitions, price/settlement calculations, date/flight-timing math.
- Zod schema behavior — valid input parses, invalid input rejects with
  the expected issue, edge cases (empty string, boundary numbers,
  optional fields) behave as intended.
- Pure UI logic extracted into a custom hook (see `frontend.md`) that
  doesn't itself call Supabase.

Unit tests should not hit a real or mocked database, network, or
filesystem — if you find yourself mocking Supabase to write one, check
whether the logic being tested actually belongs in a smaller, pure
function first.

**Write an integration test when** correctness depends on the interaction
between layers that a unit test would have to fake away — and faking it
away is exactly where real bugs hide:
- Server Actions / Route Handlers end-to-end: request in, validation,
  Supabase call, response shape out.
- **Row Level Security.** Any tenant-scoped table or policy must be
  proven with a real (or local/test-project) Supabase instance showing
  that a user from tenant A cannot read or write tenant B's rows. This
  cannot be meaningfully unit-tested with a mocked client — the whole
  point is verifying the database enforces the boundary.
- Auth/RBAC-gated flows — verify the role check actually blocks, not just
  that the code compiles.
- Multi-step domain flows that cross feature boundaries (e.g. a booking's
  lifecycle: create → assign technician → clean → inspect → return).

## Minimum coverage requirements

There's no numeric coverage threshold enforced yet (no coverage tool is
wired into CI). Until one exists, coverage is judged by these minimums
rather than a percentage:

- Every new or changed Server Action / Route Handler needs at least:
  - one happy-path test, and
  - one test covering its validation-failure path (bad input → the
    standardized error shape from `backend.md`, correct status code).
- Every new or changed RLS policy needs at least one integration test
  that proves cross-tenant access is denied, not just that same-tenant
  access is allowed.
- Every feature needs, at minimum, the happy path **plus two edge cases**
  (invalid input, boundary value, empty/missing data, permission-denied,
  or a realistic concurrent/duplicate-action case — pick what's actually
  meaningful for that feature). This is the project's baseline QA bar for
  any feature, not just an aspiration.
- If/when a coverage tool is added, set the enforced percentage threshold
  in CI config, not here — this file states the qualitative bar that
  applies regardless of tooling.

## Test naming and structure

- Name tests by expected behavior, not implementation:
  `"should return 401 when session is missing"`, not
  `"test getBooking function"`.
- One logical assertion focus per test — a failing test name should tell
  you what broke without opening the file.
- No tests that assert something trivially true just to inflate a count,
  and no skipped/pending tests reported as passing coverage.
