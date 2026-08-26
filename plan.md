# Plan — F02 Database Foundation

## Summary

Build the complete Supabase/PostgreSQL schema foundation for the platform: 11 enums, 18 tables (UUID PKs, snake_case columns, `created_at`/`updated_at` timestamps), all specified foreign keys with a deliberately chosen `ON DELETE` behavior, the required uniqueness/check constraints, the required indexes, and deterministic seed data — all delivered as Supabase CLI migrations under `supabase/migrations/`, plus a regenerated `src/types/database.types.ts` and a fully rewritten `docs/database.md`.

**Explicit scope boundary — RLS is deferred, on purpose.** The `.claude/skills/db-migration/SKILL.md` convention normally bundles RLS into the same migration as the table. This task overrides that convention: **no RLS policies are written in F02.** RLS is `F05 — Multi-tenancy + RLS`, which lands after `F03 Authentication` and `F04 RBAC`. What F02 *does* do is design every partner-owned table with an unambiguous `partner_id` or FK-traceable ownership path back to `partners`, so F05 can add `enable row level security` + policies cleanly later without a schema rework. This is a documented, scoped exception, not an oversight — it must be called out again in `docs/database.md` and flagged loudly as an interim risk (see Risks).

Out of scope for this plan (per the ticket and roadmap order): auth UI, RBAC UI, RLS policies, any CRUD page, QR generation logic, technician/cleaning/inspection workflow UI, finance calculation logic, flight API integration, KPI/ROI/AI functionality. F02 only creates the schema, seed data, and documentation that later features will build on.

## Affected files/modules

- `supabase/config.toml`, `supabase/.gitignore` — new, created by `npx supabase init` (no `supabase/` directory exists yet).
- `supabase/migrations/*.sql` — 20 new files (1 enum/extension migration + 19 table migrations, one per table, in dependency order).
- `supabase/seed.sql` — new, deterministic dev seed data.
- `src/types/database.types.ts` — replaces the current `.gitkeep` placeholder; generated via `npx supabase gen types typescript --local`.
- `docs/database.md` — rewritten from a domain placeholder into the real schema reference.
- `package.json` — no functional change planned; flagged in Open Questions whether to pin `supabase` as a devDependency for reproducibility.
- Not touched: `src/lib/supabase/{client,server,proxy}.ts` (already correct per F01), `src/features/*` (schema is project-level per the task brief, not feature-scoped), anything under `src/app`.

## Proposed enum value sets (needs sign-off before migration 0001 is written)

The ticket asks for these 11 enums but not their values; below is the inferred set, derived from the field/domain context (booking_events audit trail, technician_jobs timestamps, incident/settlement/invoice lifecycles). These are business-meaning decisions — flag for explicit confirmation, do not let the dev agent silently accept them.

| enum | proposed values |
|---|---|
| `user_role` | `operator_admin`, `partner_admin`, `partner_staff`, `technician` |
| `partner_status` | `pending`, `active`, `suspended`, `inactive` |
| `seat_status` | `available`, `reserved`, `in_use`, `cleaning`, `inspection`, `quarantine`, `retired` |
| `booking_status` | `pending`, `confirmed`, `assigned`, `in_progress`, `completed`, `cancelled`, `no_show` |
| `technician_job_status` | `assigned`, `in_progress`, `completed`, `cancelled` |
| `inspection_result` | `pass`, `conditional_pass`, `fail` |
| `incident_status` | `open`, `investigating`, `resolved`, `closed` |
| `incident_severity` | `low`, `medium`, `high`, `critical` |
| `invoice_status` | `draft`, `issued`, `paid`, `overdue`, `void` |
| `settlement_status` | `draft`, `pending_approval`, `approved`, `paid` |
| `flight_status` | `scheduled`, `delayed`, `landed`, `cancelled`, `diverted` |

`user_role` is the one most likely to need adjustment once `F04 RBAC` defines the real role model — treat this enum as provisional and expect a follow-up migration in F04 rather than assuming it's final.

## Migration strategy

**One migration per table, in strict FK-dependency order, plus one shared migration for enums/extensions/trigger helper first.** Reasoning:
- Matches the existing `.claude/skills/db-migration/SKILL.md` convention (its own example is one table per migration).
- Keeps each diff small and independently reviewable/bisectable, per `CLAUDE.md`'s general preference for small units of work — a mistake in one table's constraints doesn't force re-review of an 18-table monolith.
- Ordering by dependency layer (rather than alphabetically or ticket-list order) means every migration only references tables that already exist when it runs, so `npx supabase db reset` replays cleanly start to finish.

Derived dependency order (each table only references tables above it):

```
0001 create_enums_and_extensions   (shared: pgcrypto, all 11 enums, set_updated_at() trigger fn)
0002 create_partners_table
0003 create_airports_table
0004 create_seat_categories_table
0005 create_users_table            (needs partners for partner_id, user_role enum)
0006 create_seats_table            (needs seat_categories, airports)
0007 create_seat_status_history_table (needs seats, users)
0008 create_flights_table          (needs airports)
0009 create_bookings_table         (needs partners, airports, flights, seat_categories, seats, users)
0010 create_booking_events_table   (needs bookings, seats, users)
0011 create_technician_jobs_table  (needs bookings, users)
0012 create_installations_table    (needs technician_jobs, users)
0013 create_cleaning_records_table (needs seats, bookings, users)
0014 create_inspection_records_table (needs seats, bookings, users)
0015 create_incidents_table        (needs partners, bookings, seats, technician_jobs, users)
0016 create_partner_commercial_terms_table (needs partners)
0017 create_settlements_table      (needs partners)
0018 create_invoices_table         (needs partners, settlements)
0019 create_ai_queries_table       (needs partners, users)
```

Each table migration includes: the `create table`, its `check`/`unique`/`not null` constraints, the indexes from the required list that belong to that table, and (if it has `updated_at`) a trigger binding to the shared `set_updated_at()` function from 0001. **No `enable row level security` and no policies anywhere in this set** — per the scoped RLS deviation above. Each migration file's trailing rollback comment block follows the skill's convention (`drop table`/`drop policy` inverse — here, just `drop table`/`drop trigger`/`drop type` as applicable).

## General FK / constraint conventions (apply across all tables, stated once here rather than repeated per column)

- **PK**: every table `id uuid primary key default gen_random_uuid()` (needs `pgcrypto` enabled in 0001).
- **Timestamps**: `created_at timestamptz not null default now()` on every table; `updated_at timestamptz not null default now()` only on tables whose required-fields list includes it (mutable records) — `users, partners, airports, seat_categories, seats, bookings, technician_jobs, incidents, partner_commercial_terms, settlements, invoices, flights`. Tables without `updated_at` (`booking_events, seat_status_history, installations, cleaning_records, inspection_records, ai_queries`) are treated as append-only/immutable event or completed-record logs, matching the ticket's own field lists.
- **Nullability rule of thumb** (the ticket's "required fields" list names columns, not nullability — nullability is assigned per field below): identity/classification columns and "core accountability" FKs (who performed the primary action) are `NOT NULL`; timestamps for events that haven't necessarily happened yet (`actual_arrival_at, completed_at, resolved_at, retired_at, last_cleaned_at, last_inspected_at, quarantine_reason`) are nullable; secondary/optional linkage FKs are nullable.
- **`ON DELETE` policy (deliberate, not default-CASCADE)**: two buckets only, no CASCADE used anywhere in this schema —
  - **RESTRICT** for every FK that anchors an audit/financial/inventory record to its owning entity (`partners`, `airports`, `seat_categories`, `seats`, `bookings`, `technician_jobs`, `settlements`) and for "core accountability" actor FKs (`employee_id`, `inspector_id`, `technician_id`, `reported_by`). Effect: these parent rows can never be hard-deleted while children reference them — which is intended, since partners/seats/bookings are meant to be deactivated via their `status` column, never hard-deleted. This directly satisfies the ticket's "preserve historical/audit records — do not blindly CASCADE" instruction by making accidental data loss structurally impossible rather than just discouraged.
  - **SET NULL** for optional "assignment/reference" FKs where the child record's identity doesn't depend on the referenced row and must survive it disappearing: `bookings.assigned_seat_id`, `bookings.assigned_technician_id`, `bookings.flight_id`, `booking_events.seat_id`, `booking_events.user_id`, `installations.created_by`, `cleaning_records.booking_id`, `inspection_records.booking_id`, `incidents.booking_id`, `incidents.seat_id`, `incidents.technician_job_id`, `incidents.resolved_by`, `ai_queries.partner_id`, `ai_queries.user_id`.
  - `ai_queries` is treated as a low-stakes analytics/log table (not an operational or financial record), so both its FKs use SET NULL rather than the stricter RESTRICT default — called out explicitly as the one deliberate exception to the "RESTRICT for ownership" rule.
- **Money**: `numeric(12,2)` for all currency fields (`daily_rate, gross_revenue, partner_share, platform_share, launch_credit_target, launch_credit_accumulated, annual_fee, onboarding_fee, subtotal, vat, total, refunds, adjustments, launch_credit, final_amount`) — never `float`/`double precision`. Assumes 2-decimal currency (consistent with AED, the seeded airport's currency); flagged in Open Questions.
- **Percentages**: `numeric(5,2)` with `check (value >= 0 and value <= 100)` for `partner_share_percent`, `platform_share_percent`.

## Task list

1. **Scaffold the Supabase project.** Run `npx supabase init` to create `supabase/config.toml` and `supabase/migrations/`. Nothing else changes yet. No dependencies.

2. **Migration `0001_create_enums_and_extensions`.** `create extension if not exists pgcrypto;`, all 11 `create type ... as enum (...)` statements using the value sets above, and a shared `set_updated_at()` trigger function (`new.updated_at = now(); return new;`) to be attached per-table in later migrations. Depends on: task 1. Needs enum-value sign-off (see Open Questions) before being finalized.

3. **Migration `0002_create_partners_table`.** Columns: `id, name (text, not null), code (text, not null, unique), contact_email (text, not null), status (partner_status, not null, default 'pending'), created_at, updated_at` + `updated_at` trigger. No indexes beyond the implicit unique index on `code`. Depends on: task 2.

4. **Migration `0003_create_airports_table`.** Columns: `id, code (text, not null, unique), name (text, not null), city (text, not null), country (text, not null), timezone (text, not null), created_at, updated_at` + trigger. Depends on: task 2.

5. **Migration `0004_create_seat_categories_table`.** Columns: `id, name (text, not null), description (text, nullable), min_child_age (integer, not null), max_child_age (integer, not null, check max_child_age >= min_child_age), safety_standard (text, not null), is_active (boolean, not null, default true), created_at, updated_at` + trigger. Age unit (months vs years) is ambiguous — flagged in Open Questions; proposed as integer months pending confirmation. Depends on: task 2.

6. **Migration `0005_create_users_table`.** Columns: `id, email (text, not null, unique), full_name (text, not null), role (user_role, not null), partner_id (uuid, nullable — null for operator_admin users who aren't tied to a partner; FK → partners.id ON DELETE RESTRICT), is_active (boolean, not null, default true), created_at, updated_at` + trigger. Indexes: `partner_id`, `role` (both required by ticket #7). Depends on: tasks 2, 3 (order-only; actual FK dependency is on partners from task 3).

7. **Migration `0006_create_seats_table`.** Columns: `id, public_token (text, not null, unique, default gen_random_uuid()::text — placeholder format, real format is an F10 decision), serial_number (text, not null, unique), manufacturer (text, not null), model (text, not null), category_id (uuid, not null, FK → seat_categories.id ON DELETE RESTRICT), airport_id (uuid, not null, FK → airports.id ON DELETE RESTRICT), status (seat_status, not null, default 'available'), manufacture_date (date, not null), purchase_date (date, not null), rental_cycles (integer, not null, default 0, check >= 0), max_rental_cycles (integer, not null, check > 0), last_cleaned_at (timestamptz, nullable), last_inspected_at (timestamptz, nullable), quarantine_reason (text, nullable), retired_at (timestamptz, nullable), created_at, updated_at` + trigger. Indexes: `category_id, airport_id, status` (unique on `public_token` already gives that lookup an index). Depends on: tasks 3, 4.

8. **Migration `0007_create_seat_status_history_table`.** **Note: this table's field list is absent from the ticket's "required fields per table" section** (only appears in the table list and the FK relationship list) — proposed schema, needs confirmation: `id, seat_id (uuid, not null, FK → seats.id ON DELETE RESTRICT), from_status (seat_status, nullable — null on the seat's first history row), to_status (seat_status, not null), changed_by (uuid, nullable, FK → users.id ON DELETE SET NULL), reason (text, nullable), created_at (timestamptz, not null, default now())`. No `updated_at` (immutable log). Index on `seat_id` (inferred, not in the required list, but no way to query seat history efficiently without it). Depends on: task 7 (seats) and task 6 (users).

9. **Migration `0008_create_flights_table`.** Columns: `id, flight_number (text, not null), airport_id (uuid, not null, FK → airports.id ON DELETE RESTRICT), scheduled_arrival_at (timestamptz, not null), estimated_arrival_at (timestamptz, nullable), actual_arrival_at (timestamptz, nullable), status (flight_status, not null, default 'scheduled'), terminal (text, nullable), delay_minutes (integer, nullable), last_synced_at (timestamptz, nullable), provider (text, nullable), created_at, updated_at` + trigger. Indexes: `flight_number, airport_id`. Depends on: task 4 (airports).

10. **Migration `0009_create_bookings_table`.** Columns: `id, booking_number (text, not null, unique), partner_id (uuid, not null, FK → partners.id ON DELETE RESTRICT), airport_id (uuid, not null, FK → airports.id ON DELETE RESTRICT), external_booking_number (text, nullable), pickup_at (timestamptz, not null), return_at (timestamptz, not null), flight_id (uuid, nullable, FK → flights.id ON DELETE SET NULL), scheduled_arrival_at (timestamptz, nullable), estimated_arrival_at (timestamptz, nullable), actual_arrival_at (timestamptz, nullable), seat_category_id (uuid, not null, FK → seat_categories.id ON DELETE RESTRICT), child_age_band (text, nullable — not one of the 11 named enums, kept as free text pending clarification), child_height (numeric(5,1), nullable), vehicle (text, nullable), vehicle_bay (text, nullable), assigned_seat_id (uuid, nullable, FK → seats.id ON DELETE SET NULL), assigned_technician_id (uuid, nullable, FK → users.id ON DELETE SET NULL), daily_rate (numeric(12,2), not null), paid_days (integer, not null, default 0, check >= 0), gross_revenue (numeric(12,2), nullable — computed later by F22), partner_share (numeric(12,2), nullable), platform_share (numeric(12,2), nullable), status (booking_status, not null, default 'pending'), incident_status (incident_status, nullable), notes (text, nullable), created_at, updated_at` + trigger. Indexes: `partner_id, status, pickup_at, return_at, assigned_seat_id, assigned_technician_id, flight_id`. Depends on: tasks 3 (partners), 4 (airports), 5 (seat_categories), 7 (seats), 6 (users), 9 (flights).

11. **Migration `0010_create_booking_events_table`.** Columns: `id, booking_id (uuid, not null, FK → bookings.id ON DELETE RESTRICT), seat_id (uuid, nullable, FK → seats.id ON DELETE SET NULL), user_id (uuid, nullable, FK → users.id ON DELETE SET NULL), from_status (booking_status, nullable), to_status (booking_status, not null), notes (text, nullable), metadata (jsonb, nullable), created_at (timestamptz, not null, default now())`. No `updated_at` (immutable). Indexes: `booking_id, created_at`. Depends on: task 10 (bookings).

12. **Migration `0011_create_technician_jobs_table`.** Columns: `id, booking_id (uuid, not null, FK → bookings.id ON DELETE RESTRICT), technician_id (uuid, not null, FK → users.id ON DELETE RESTRICT), assigned_at (timestamptz, not null, default now()), started_at (timestamptz, nullable), completed_at (timestamptz, nullable), vehicle_bay (text, nullable), status (technician_job_status, not null, default 'assigned'), installation_notes (text, nullable), created_at, updated_at` + trigger. Indexes: `technician_id, status, booking_id`. Depends on: task 10 (bookings).

13. **Migration `0012_create_installations_table`.** Columns: `id, technician_job_id (uuid, not null, FK → technician_jobs.id ON DELETE RESTRICT), seat_verified (boolean, not null, default false), category_verified (boolean, not null, default false), installation_completed (boolean, not null, default false), vehicle_location (text, nullable), photo_path (text, nullable), notes (text, nullable), completed_at (timestamptz, nullable), created_by (uuid, nullable, FK → users.id ON DELETE SET NULL), created_at (timestamptz, not null, default now())`. No `updated_at`. No indexes in the required list. Depends on: task 12 (technician_jobs).

14. **Migration `0013_create_cleaning_records_table`.** Columns: `id, seat_id (uuid, not null, FK → seats.id ON DELETE RESTRICT), booking_id (uuid, nullable, FK → bookings.id ON DELETE SET NULL — cleaning can occur outside a booking context), employee_id (uuid, not null, FK → users.id ON DELETE RESTRICT), started_at (timestamptz, not null), completed_at (timestamptz, nullable), checklist (jsonb, nullable), passed (boolean, nullable), notes (text, nullable), photo_path (text, nullable), created_at (timestamptz, not null, default now())`. No `updated_at`. No indexes in the required list. Depends on: tasks 7 (seats), 10 (bookings), 6 (users).

15. **Migration `0014_create_inspection_records_table`.** Columns: `id, seat_id (uuid, not null, FK → seats.id ON DELETE RESTRICT), booking_id (uuid, nullable, FK → bookings.id ON DELETE SET NULL), inspector_id (uuid, not null, FK → users.id ON DELETE RESTRICT), inspection_type (text, not null — not one of the 11 named enums), result (inspection_result, not null), checklist (jsonb, nullable), notes (text, nullable), photo_path (text, nullable), created_at (timestamptz, not null, default now())`. No `updated_at`. No indexes in the required list. Depends on: tasks 7 (seats), 10 (bookings), 6 (users).

16. **Migration `0015_create_incidents_table`.** Columns: `id, partner_id (uuid, not null, FK → partners.id ON DELETE RESTRICT), booking_id (uuid, nullable, FK → bookings.id ON DELETE SET NULL), seat_id (uuid, nullable, FK → seats.id ON DELETE SET NULL), technician_job_id (uuid, nullable, FK → technician_jobs.id ON DELETE SET NULL), type (text, not null), severity (incident_severity, not null), status (incident_status, not null, default 'open'), description (text, not null), reported_by (uuid, not null, FK → users.id ON DELETE RESTRICT), resolved_by (uuid, nullable, FK → users.id ON DELETE SET NULL), resolved_at (timestamptz, nullable), created_at, updated_at` + trigger. Indexes: `partner_id, status`. Depends on: tasks 3 (partners), 10 (bookings), 7 (seats), 12 (technician_jobs).

17. **Migration `0016_create_partner_commercial_terms_table`.** Columns: `id, partner_id (uuid, not null, FK → partners.id ON DELETE RESTRICT), partner_share_percent (numeric(5,2), not null, check between 0 and 100), platform_share_percent (numeric(5,2), not null, check between 0 and 100), launch_mode (boolean, not null, default false — type is a guess, see Open Questions), launch_credit_target (numeric(12,2), nullable), launch_credit_accumulated (numeric(12,2), nullable, default 0), annual_fee (numeric(12,2), nullable), onboarding_fee (numeric(12,2), nullable), effective_from (date, not null), effective_to (date, nullable), created_at, updated_at` + trigger. No indexes in the required list. Depends on: task 3 (partners).

18. **Migration `0017_create_settlements_table`.** Columns: `id, partner_id (uuid, not null, FK → partners.id ON DELETE RESTRICT), period_start (date, not null), period_end (date, not null, check >= period_start), gross_revenue (numeric(12,2), not null, default 0), partner_share (numeric(12,2), not null, default 0), platform_share (numeric(12,2), not null, default 0), refunds (numeric(12,2), not null, default 0), adjustments (numeric(12,2), not null, default 0), launch_credit (numeric(12,2), not null, default 0), final_amount (numeric(12,2), not null, default 0), status (settlement_status, not null, default 'draft'), created_at, updated_at` + trigger. Index: `partner_id`. Depends on: task 3 (partners).

19. **Migration `0018_create_invoices_table`.** Columns: `id, partner_id (uuid, not null, FK → partners.id ON DELETE RESTRICT), settlement_id (uuid, nullable, FK → settlements.id ON DELETE RESTRICT), invoice_number (text, not null, unique), issue_date (date, not null), due_date (date, not null), subtotal (numeric(12,2), not null), vat (numeric(12,2), not null, default 0), total (numeric(12,2), not null), status (invoice_status, not null, default 'draft'), pdf_path (text, nullable), created_at, updated_at` + trigger. Indexes: `partner_id, status`. Depends on: tasks 3 (partners), 18 (settlements).

20. **Migration `0019_create_ai_queries_table`.** Columns: `id, partner_id (uuid, nullable, FK → partners.id ON DELETE SET NULL), user_id (uuid, nullable, FK → users.id ON DELETE SET NULL), question (text, not null), intent (text, nullable), query_result (jsonb, nullable), answer (text, nullable), created_at (timestamptz, not null, default now())`. No `updated_at`. No indexes in the required list. Depends on: tasks 3 (partners), 6 (users).

21. **Local verification pass 1.** Run `npx supabase db reset` and confirm all 19 table migrations plus the enum migration replay cleanly against local Docker Postgres in order, with no FK/ordering errors. Fix any migration file in place if it hasn't been "shipped" yet (per skill: never hand-edit an already-applied/committed migration once merged — this is the pre-merge iteration pass). Depends on: tasks 2–20.

22. **Deterministic seed data — `supabase/seed.sql`.** Insert, with fixed literal UUIDs (never relying on the tables' `gen_random_uuid()` defaults, so re-running `db reset` produces byte-identical IDs every time): 1 airport (DXB), 2 partners, 4 seat categories, 3 technician users (`role = 'technician'`), 40 seats (via `generate_series` with a deterministic UUID construction — e.g. a fixed-prefix literal string per row, not `gen_random_uuid()`), 20 bookings referencing the seeded partners/airport/categories/seats. Re-run `npx supabase db reset` (which auto-applies `seed.sql`) to confirm the seed inserts cleanly against the constraints from tasks 2–20 (unique codes, check constraints, FK integrity). Depends on: task 21.

23. **Regenerate types.** Run `npx supabase gen types typescript --local > src/types/database.types.ts`, replacing the `.gitkeep` placeholder. Depends on: task 22 (schema + seed both stable).

24. **Rewrite `docs/database.md`.** Full schema reference: all 18 tables with columns/types/constraints, all 11 enums and their value sets, the relationship/FK diagram with each `ON DELETE` choice and its justification, the index list and what each supports, the migration strategy (one file per table, dependency order, rationale), the seed strategy (fixed-UUID determinism, what's seeded), and — prominently — the RLS-deferred-to-F05 architectural decision with a note that no tenant-scoped table is safe to query from real user-facing code until F05 lands. Depends on: task 23.

25. **Run lint/typecheck/build.** `npm run lint` and `npx tsc --noEmit` to confirm the regenerated `database.types.ts` doesn't surface any pre-existing type errors and the repo is otherwise clean; this is the last implementation task before handoff to review/QA. Depends on: task 24.

## Dependencies

- Task 1 blocks every migration task (2–20) — `supabase/` doesn't exist until `init` runs.
- Task 2 (enums + trigger fn) blocks every table migration (3–20) — nearly every table references an enum or the `set_updated_at()` trigger.
- Table migrations must land in the dependency order given (task N generally blocks any later task whose table has an FK to it) — see the "Migration strategy" ordering table above for the exact chain; the task list already reflects that order.
- Task 21 (full `db reset` verification) depends on all of 2–20 and blocks 22.
- Task 22 (seed) depends on 21 and blocks 23.
- Task 23 (type generation) depends on 22 and blocks 24 and 25.
- Task 24 (docs) depends on 23; task 25 (lint/build) depends on 24 and is the final task in this plan.
- **Cross-feature dependency**: no Server Action, Route Handler, or Server Component may query any table created here until `F05 — Multi-tenancy + RLS` has added RLS policies — this blocks the start of `F06 Partner Management` (and any other F06+ feature that reads/writes these tables) on F05, not just on F02.

## Risks & edge cases

- **RLS gap by design.** Between F02 landing and F05 landing, these tables have zero RLS protection. As long as no application code queries them (true for F02's scope), there's no live exposure — but this must be treated as a hard gate: if any interim feature (e.g. an F03 auth flow that reads `users`) needs to query a tenant-scoped table before F05 ships, that's a security review item, not a shortcut to take unilaterally.
- **Inferred, unconfirmed schema pieces**: `seat_status_history`'s entire column list (absent from the ticket's required-fields section), the 11 enum value sets, `child_age_band` and `inspection_type` as free text (not enums), `launch_mode`'s type (guessed boolean), and the unit for `min_child_age`/`max_child_age` (guessed months). Each is a business-meaning decision the dev agent shouldn't finalize unreviewed — see Open Questions.
- **Wide `ON DELETE RESTRICT` usage** means partners/airports/seats/bookings/etc. can effectively never be hard-deleted once they have any child row (which will be almost immediately, in practice). This is intentional (matches "preserve audit records") but means any future "delete a test partner" admin tool must go through the `status` soft-delete columns, not a real `DELETE`. Worth stating explicitly in `docs/database.md` so it isn't rediscovered as a bug later.
- **Money precision assumption.** `numeric(12,2)` (2 decimal places) is proposed based on AED being the seeded currency; if the platform later supports a currency needing 3 decimals, this is a migration, not a code fix.
- **19-file migration set increases ordering-mistake risk.** Mitigated by the dependency-ordered task list and the mandatory `db reset` full-replay step (task 21) before seed data or type generation happens.
- **Seed determinism.** Every seeded row must use a literal fixed UUID, not the table's `gen_random_uuid()` default — if any seed `INSERT` omits the `id` column, re-running `db reset` will silently produce different IDs each time, breaking the "deterministic" requirement without an obvious error.
- **`pgcrypto` extension availability.** `gen_random_uuid()` requires it; must be explicitly `create extension if not exists pgcrypto;` in migration 0001 rather than assumed present.
- **Everything downstream depends on this schema being right.** F06 through F28 all build on these tables; a wrong nullability or enum choice here is expensive to unwind once real data and RLS policies exist on top of it — extra scrutiny on the flagged open questions before merging is worth the friction.

## Open questions

1. **Enum value sets** (all 11, listed above) — need explicit confirmation before migration 0001 is finalized; `user_role` in particular is likely to need revision once F04 RBAC defines the real role model.
2. **`seat_status_history` columns** — not specified anywhere in the ticket's required-fields list. Proposed: `id, seat_id, from_status, to_status, changed_by, reason, created_at`. Confirm or correct before task 8.
3. **`min_child_age`/`max_child_age` unit** — months or years? Proposed months for precision; not stated in the ticket.
4. **`child_age_band` on `bookings`** — free text or should this be a 12th enum? Not in the ticket's list of 11 enums, so kept as text; confirm.
5. **`partner_commercial_terms.launch_mode` type** — boolean flag vs. a status-like value (`not_started`/`active`/`completed`)? Name suggests the latter but it's not one of the 11 named enums either way.
6. **Should `partner_share_percent + platform_share_percent` be constrained to sum to 100?** Ticket only asks for each to be within 0–100 individually; a combined check is a reasonable business rule but wasn't requested — confirm before adding it.
7. **Money precision** — is `numeric(12,2)` (2 decimals) correct for all currency fields, or does any figure need finer precision?
8. **`seats.public_token` format** — this plan defaults it to a UUID-shaped placeholder (`gen_random_uuid()::text`) purely so the `NOT NULL UNIQUE` constraint is satisfiable now; the real public QR-token format is an `F10` decision and may require a follow-up migration to change the column type/generation strategy.
9. **Should the Supabase CLI be pinned as a `devDependency`** in `package.json` (currently only available via floating `npx supabase`), for reproducible migrations across contributors/CI? Not requested explicitly; flagging rather than adding unilaterally.
