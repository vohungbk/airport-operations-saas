# Data rules and how they are tested (VI-F08-S03)

Spec VI-F08 R3: constraints, business rules and history consistency are verified
before a release. They run with `npm test`, so they are part of the tests gate of
`npm run release:gates`. They need the local Supabase stack and skip themselves
without it (the gate is then Not run, see [release-gates.md](release-gates.md)).

| Rule | What is checked | Where |
|---|---|---|
| **Constraints**: every CHECK, UNIQUE and standalone unique index | A row just inside the rule is accepted, the row just outside it is refused with the name of that rule (SQLSTATE 23514 or 23505). A new constraint with no case fails the check. | `src/lib/data-rules/data-rules.integration.test.ts` |
| **Business rules**: moving a booking, seat, job or incident along its states | Valid and refused transitions, who may do it, the reason or note a transition needs. A new `change_*` function with no test of a refused transition fails the check. | RLS suite `src/lib/auth/rls.integration.test.ts` (checked by the file above) |
| **History**: the log of status changes | `booking_events`, `technician_job_events` and `incident_status_history` refuse UPDATE, DELETE and TRUNCATE, even for the database owner. `seat_status_history` is append-only by RLS. A history chain ends at the status of its record. | `data-rules.integration.test.ts`; RLS suite; `src/lib/demo/demo-data.integration.test.ts` (the chains of the demo data) |

## How the constraint cases work

Each case runs inside a transaction that is rolled back, so nothing is left in
the database and other suites are not affected. `session_replication_role =
replica` switches off the triggers and the foreign keys for those inserts, so a
case needs no parent rows and tests the constraint alone. CHECK and UNIQUE are
still enforced in that mode.

To add a rule: add a `Case` to `CASES` with the rows just inside and just outside
it. If you add a `change_*` function, add a test of a refused transition that names
it. If you add a history table with a `prevent_*_update` trigger, add it to
`HISTORY_TABLES`.
