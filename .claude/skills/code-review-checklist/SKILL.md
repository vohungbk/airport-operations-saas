---
name: code-review-checklist
description: This project's automated code-review checklist — applied to a git diff or PR against naming conventions, error handling, security (RLS/service-role keys/secrets/tenant isolation), N+1 query performance, and test coverage, checked against .claude/rules/*.md and CLAUDE.md. Use when asked to review a PR, review this diff, review my changes, check this branch before merging, or run a code review for this repo.
---

Apply this checklist to `git diff` / the PR under review. It's the
project-specific rubric behind the `reviewer` agent
(`.claude/agents/reviewer.md`) and the project's `.claude/rules/*.md` —
use it there, or standalone when asked to review changes directly.

Scope: only the diff and the surrounding code needed to understand it.
Read-only — this skill never edits code, only reports findings.

## Checklist

### 1. Naming conventions
- Database/API fields are snake_case (`CLAUDE.md`); TS-only
  variables/functions are camelCase; components/types are PascalCase.
- Test names state expected behavior ("should ... when ..."), not
  implementation (`.claude/rules/testing.md`).
- No abbreviations that obscure meaning; names match the domain
  vocabulary already used in `docs/architecture.md`.

### 2. Error handling
- Every Server Action / Route Handler validates external input with Zod
  before using it (`.claude/rules/backend.md`) — flag any handler that
  trusts `request.json()` or a form field directly.
- Route Handler errors return the standardized
  `{ error: { code, message, details? } }` shape with the correct HTTP
  status — flag ad hoc error shapes or a raw thrown error reaching the
  client.
- No swallowed errors (empty `catch {}` that hides a real failure) and no
  leaked internals (stack traces, raw Postgres error text) in a response
  sent to the client.

### 3. Security
- Supabase service-role/secret key never appears in client code, a
  Client Component, or a `NEXT_PUBLIC_*` variable (`docs/security.md`).
- Tenant isolation is never implemented as *only* an app-level
  `.eq("tenant_id", ...)` filter with no RLS behind it — flag a new
  tenant-scoped table/query with no accompanying RLS policy.
- Auth/session is checked before any mutation; role checks happen
  server-side, not inferred from UI state.
- No secrets, tokens, or PII in log statements.
- No unvalidated input reaching a Supabase filter, RPC call, or raw SQL.

### 4. N+1 query performance
- Flag any loop that issues one Supabase call per iteration:
  ```ts
  // BAD — one query per booking
  for (const booking of bookings) {
    const { data } = await supabase.from("seats").select("*").eq("id", booking.seat_id);
  }
  ```
  The fix is a nested `select` or a single batched `.in(...)` query
  (`.claude/rules/backend.md`):
  ```ts
  // GOOD — one query total
  const { data } = await supabase
    .from("bookings")
    .select("*, seat:seats(*)");
  ```

### 5. Test coverage
- New/changed Server Action or Route Handler has at least a happy-path
  test and a validation-failure test.
- New/changed RLS policy has an integration test proving cross-tenant
  access is denied, not just that same-tenant access works.
- The feature as a whole covers the happy path plus at least two edge
  cases (`.claude/rules/testing.md`).
- No tests were deleted or skipped to make a diff pass without a noted
  reason.

## Output format

Rank findings most-severe first (security > correctness/error-handling >
performance > naming/style). For each:

- **File:line**
- **Category** — one of the five sections above
- **Summary** — one sentence stating the defect
- **Why it matters** — concrete scenario where it breaks or causes harm
- **Suggested fix** — described, not applied

If nothing significant is found in a category, say so — don't invent
nitpicks to pad the report.

## Example

### Input

A diff adding `src/app/api/bookings/route.ts`:

```diff
+export async function POST(request: Request) {
+  const body = await request.json();
+  const supabase = await createClient();
+
+  const seats = [];
+  for (const seatId of body.seat_ids) {
+    const { data } = await supabase.from("seats").select("*").eq("id", seatId).single();
+    seats.push(data);
+  }
+
+  const { data, error } = await supabase.from("bookings").insert({
+    customer_name: body.customerName,
+    seat_ids: body.seat_ids,
+  });
+
+  return Response.json(data);
+}
```

### Output

```
[SECURITY] src/app/api/bookings/route.ts:2 — no input validation
  Why it matters: `body` is used directly from an unvalidated JSON
  payload (customerName, seat_ids) — a malformed or malicious request
  reaches the Supabase insert with no shape/type guarantees.
  Suggested fix: parse `body` with a Zod schema and `safeParse()` before
  use; return VALIDATION_ERROR (400) on failure, per
  .claude/rules/backend.md.

[PERFORMANCE] src/app/api/bookings/route.ts:6-9 — N+1 query
  Why it matters: issues one `seats` query per entry in `seat_ids`
  instead of a single batched query; latency grows linearly with the
  number of seats in a booking.
  Suggested fix: replace the loop with
  `supabase.from("seats").select("*").in("id", body.seat_ids)`.

[ERROR HANDLING] src/app/api/bookings/route.ts:11-14 — insert error ignored,
  response shape not standardized
  Why it matters: `error` from the insert is never checked, so a failed
  insert still returns 200 with `data: null`; the response also isn't
  wrapped in the project's `{ data }` / `{ error }` shape.
  Suggested fix: check `error` and return `jsonError("INTERNAL_ERROR", ...,
  500)`; return successful data via `jsonSuccess(data, 201)`.

[NAMING] src/app/api/bookings/route.ts:12 — camelCase field sent to a
  snake_case column
  Why it matters: `customerName` won't map to a `customer_name` column;
  this likely fails silently or throws depending on the client.
  Suggested fix: use `customer_name` in the request schema/body to match
  the database field, per CLAUDE.md.

[TEST COVERAGE] no tests found for this route
  Why it matters: neither the happy path nor the validation-failure path
  has a test, so a regression here won't be caught in CI.
  Suggested fix: add `route.test.ts` covering both, per
  .claude/rules/testing.md and .claude/skills/api-integration/SKILL.md.
```
