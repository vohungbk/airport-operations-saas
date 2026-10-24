# Database

This is the schema reference for `F02 — Database Foundation`. It covers
the enums, tables, relationships, indexes, migration strategy, and seed
data delivered by F02. See `plan.md` (F02) for the full task-by-task
rationale this document summarizes.

> **RLS IS ENABLED on all 18 tables below, as of `F05 — Multi-tenancy +
> RLS`.**
>
> `supabase/migrations/20260902085338_enable_rls_multi_tenancy.sql` turns
> on `enable row level security` plus explicit `select`/`insert`/`update`
> policies for every table listed here. No table has a `delete` policy for
> any role (see "No DELETE policy" below) — RLS denies `DELETE` by default
> everywhere.
>
> - Four `SECURITY DEFINER` helper functions centralize the "who is
>   calling and what can they see" checks: `current_user_role()`,
>   `current_user_partner_id()`, `is_internal_user()`,
>   `is_admin_or_ops_manager()`. A fifth, `booking_partner_id(uuid)`,
>   exists purely to break an RLS recursion cycle between `bookings` and
>   `technician_jobs` (see the migration file's comment on that
>   function). See `docs/security.md`'s F05 section for the full
>   per-table access rules.
> - Anonymous (`anon`) access is denied by default on every table,
>   including the three "shared reference data" tables (`airports`,
>   `seat_categories`, `flights`) whose `select` policy is `to
>   authenticated using (true)` — that clause is scoped to `authenticated`
>   only, never `anon`.
> - No service-role client exists in this codebase; nothing bypasses RLS
>   from application code.
>
> See the "Row Level Security (F05)" section below for the ownership
> table, new indexes, and the `USING (true)` caution on shared reference
> data.

## Extensions

- `pgcrypto` — required for `gen_random_uuid()`, used as the default for
  every table's `id` primary key.

## Enums

All 11 enums are created in
`supabase/migrations/20260826083733_create_enums_and_extensions.sql`.

| enum | values |
|---|---|
| `user_role` | `admin`, `operations_manager`, `technician`, `partner_user` |
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

`user_role` was finalized by `F04 — RBAC`
(`supabase/migrations/20260828065217_redefine_user_role_enum.sql`), which
replaced the original 4 F02 placeholder values with the ticket's real role
model (`operator_admin → admin`, `partner_admin`/`partner_staff` →
`partner_user`, `technician` unchanged, `operations_manager` added new).

`child_age_band` (on `bookings`) and `inspection_type` (on
`inspection_records`) are free text, not enums — they weren't part of the
11 named enums the spec called for.

## Shared trigger helper

`set_updated_at()` — a `plpgsql` trigger function that sets
`new.updated_at = now()`. Bound via a per-table `before update` trigger on
every table that has an `updated_at` column.

## Tables

Every table has `id uuid primary key default gen_random_uuid()` and
`created_at timestamptz not null default now()`. Only tables listed as
"mutable" below also carry `updated_at timestamptz not null default now()`
plus a `set_updated_at()` trigger; the rest are treated as append-only
event/completed-record logs and have no `updated_at`.

### `partners` (mutable)
| column | type | notes |
|---|---|---|
| name | text not null | |
| code | text not null unique | |
| contact_email | text not null | |
| status | partner_status not null default 'pending' | |

### `airports` (mutable, shared reference data)
| column | type | notes |
|---|---|---|
| code | text not null unique | |
| name | text not null | |
| city | text not null | |
| country | text not null | |
| timezone | text not null | |

> `airports` is unchanged by `F07 — Airport Management` — see `plan.md`
> (F07). F07 is an application-layer CRUD module on top of this existing
> schema and F05's existing RLS policies; no column, constraint, or
> policy was added or modified. `code` format (uppercase alphanumeric,
> 2-10 chars) is validated in Zod only, not backed by a DB `CHECK`
> constraint.

### `seat_categories` (mutable)
| column | type | notes |
|---|---|---|
| name | text not null | |
| description | text | nullable |
| min_child_age | integer not null | months |
| max_child_age | integer not null | months; `check (max_child_age >= min_child_age)` |
| safety_standard | text not null | |
| is_active | boolean not null default true | |

### `users` (mutable)
| column | type | notes |
|---|---|---|
| email | text not null unique | |
| full_name | text not null | |
| role | user_role not null | |
| partner_id | uuid, FK → partners.id ON DELETE RESTRICT | nullable — null for `admin`/`operations_manager`/`technician` users not tied to a partner |
| is_active | boolean not null default true | |

Indexes: `partner_id`, `role`.

### `seats` (mutable)
| column | type | notes |
|---|---|---|
| public_token | text not null unique default gen_random_uuid()::text | the one token of the seat, used to make its permanent QR code. It identifies the seat only: it carries no personal or booking data, grants no access and does not authenticate (PO Decision Log, PRD v1.1 section 20). The value is the database default (a UUID as text). The URL format and token revocation are open (PRD section 17). |
| serial_number | text not null unique | |
| manufacturer | text not null | |
| model | text not null | |
| category_id | uuid not null, FK → seat_categories.id ON DELETE RESTRICT | |
| airport_id | uuid not null, FK → airports.id ON DELETE RESTRICT | |
| status | seat_status not null default 'available' | |
| manufacture_date | date not null | |
| purchase_date | date not null | |
| rental_cycles | integer not null default 0 | `check (>= 0)` |
| max_rental_cycles | integer not null | `check (> 0)` |
| last_cleaned_at | timestamptz | nullable |
| last_inspected_at | timestamptz | nullable |
| quarantine_reason | text | nullable |
| retired_at | timestamptz | nullable |

Indexes: `category_id`, `airport_id`, `status` (`public_token` and
`serial_number` already get an index from their unique constraints).

### `seat_status_history` (immutable log)
| column | type | notes |
|---|---|---|
| seat_id | uuid not null, FK → seats.id ON DELETE RESTRICT | |
| from_status | seat_status | nullable — null on a seat's first history row |
| to_status | seat_status not null | |
| changed_by | uuid, FK → users.id ON DELETE SET NULL | nullable |
| reason | text | nullable |

Index: `seat_id`. This table's column list was not specified in the
original ticket's required-fields section — it is a proposed schema
(see plan.md open question 2).

**F09 additions** (`20260930090000_seat_status_history_trigger_and_change_seat_status.sql`):
`seats` has an `AFTER INSERT` trigger and an `AFTER UPDATE OF status`
trigger (`record_seats_status_insert`/`record_seats_status_update`)
calling `public.record_seat_status_change()`, which appends the history
row (initial row has `from_status` null). Manual status changes go
through `public.change_seat_status(uuid, seat_status, text)`; see
`docs/security.md` (F09) for the allowed transitions and error codes.
A `BEFORE UPDATE` trigger (`guard_seats_update`, function
`public.guard_seat_update()`) makes `serial_number` and `public_token`
immutable, makes `retired` terminal, and rejects status, `retired_at` and
`quarantine_reason` changes made outside `change_seat_status()` (SQLSTATE
`55000`). Rollback SQL is in a comment at the bottom of the migration file.

### `flights` (mutable, shared reference data)
| column | type | notes |
|---|---|---|
| flight_number | text not null | |
| airport_id | uuid not null, FK → airports.id ON DELETE RESTRICT | |
| scheduled_arrival_at | timestamptz not null | |
| estimated_arrival_at | timestamptz | nullable |
| actual_arrival_at | timestamptz | nullable |
| status | flight_status not null default 'scheduled' | |
| terminal | text | nullable |
| delay_minutes | integer | nullable |
| last_synced_at | timestamptz | nullable |
| provider | text | nullable |

Indexes: `flight_number`, `airport_id`.

### `bookings` (mutable)
| column | type | notes |
|---|---|---|
| booking_number | text not null unique | |
| partner_id | uuid not null, FK → partners.id ON DELETE RESTRICT | |
| airport_id | uuid not null, FK → airports.id ON DELETE RESTRICT | |
| external_booking_number | text | nullable |
| pickup_at | timestamptz not null | |
| return_at | timestamptz not null | |
| flight_id | uuid, FK → flights.id ON DELETE SET NULL | nullable |
| scheduled_arrival_at / estimated_arrival_at / actual_arrival_at | timestamptz | nullable |
| seat_category_id | uuid not null, FK → seat_categories.id ON DELETE RESTRICT | |
| child_age_band | text | nullable, free text |
| child_height | numeric(5,1) | nullable |
| vehicle / vehicle_bay | text | nullable |
| assigned_seat_id | uuid, FK → seats.id ON DELETE SET NULL | nullable |
| assigned_technician_id | uuid, FK → users.id ON DELETE SET NULL | nullable |
| daily_rate | numeric(12,2) not null | |
| paid_days | integer not null default 0 | `check (>= 0)` and `check (<= 6)`: never above the six-day cap (VI-F04-S04) |
| rental_days | integer | nullable; `check (>= 0)`; the actual number of rental days, not capped; set when the booking is completed |
| revenue_flag | text | nullable; `check (null or 'invalid_duration' or 'no_terms')`; `invalid_duration`: a completed rental has no duration; `no_terms`: the partner had no terms in force |
| gross_revenue | numeric(12,2) | nullable; `check (>= 0)`; paid days x the daily rate, set when the booking is completed (VI-F04-S04) |
| partner_share / platform_share | numeric(12,2) | nullable; each `check (>= 0)`; both set or both null; together they add up to `gross_revenue` (VI-F04-S05) |
| adjustments_total | numeric(12,2) not null default 0 | `check (<= 0)`; the sum of the adjustments recorded on the booking (they take money away, so it is zero or negative); written only by `add_booking_adjustment()` (VI-F04-S10) |
| revenue_case | text | nullable; `check (standard, early_return, cancelled or no_show)`; the case that priced the booking (VI-F04-S07) |
| actual_return_at | timestamptz | nullable; `check (not before pickup_at)`; when the rental was really returned; the workflow that completes a rental (F14, F15) will write it |
| commercial_terms_id | uuid, FK → partner_commercial_terms.id ON DELETE RESTRICT | nullable; the version of the terms the shares were calculated with |
| launch_credit | numeric(12,2) not null default 0 | `check (>= 0)`; the extra the partner got on this rental above the standard share (VI-F04-S06) |
| launch_credit_balance | numeric(12,2) | nullable; `check (>= 0)`; the launch credit of the partner after this rental; null when launch did not apply; it may be above the target (the rental that crosses it); `launch_credit` is 0 when it is null |
| status | booking_status not null default 'pending' | |
| incident_status | incident_status | nullable |
| notes | text | nullable |

Indexes: `partner_id`, `status`, `pickup_at`, `return_at`,
`assigned_seat_id`, `assigned_technician_id`, `flight_id`.

**Six-day cap (VI-F04-S04, migration `20261107090000_booking_paid_days_cap.sql`).** When a booking
becomes `completed`, the trigger `set_booking_revenue_on_completion` calls
`public.booking_revenue_terms(pickup_at, return_at, daily_rate)` and writes `rental_days`,
`paid_days`, `gross_revenue` and `revenue_flag`. Rental days count every started 24 hours from the
pickup to the return (24 hours is 1 day, 24 hours and 1 second is 2; it does not depend on a time
zone; this is an assumption until the product owner decides). Paid days are the smaller of the rental
days and 6, and the gross revenue is the paid days x the daily rate, exact. `pickup_at` and
`return_at` are not touched, so the actual duration stays. A rental with no duration gets
`rental_days` 0, `paid_days` 0, `gross_revenue` null and `revenue_flag = 'invalid_duration'`; the
table already refuses a return before the pickup. The calculation runs again if the period or the
daily rate of a completed booking changes, which clears the flag once the period is corrected. The
six is a constant in that function and in `bookings_paid_days_cap_check`. `rental_days` and
`revenue_flag` can only be changed in the booking functions, like the other finance fields. Nothing
sets a booking to `completed` yet (the return chain, F14 and F15, will); the trigger applies the
rule to any path that does. Rollback SQL is at the top of the migration.

**Revenue shares (VI-F04-S05, migration `20261108090000_booking_revenue_shares.sql`).** The same
trigger also writes `partner_share`, `platform_share` and `commercial_terms_id`. The terms are the
version of the partner in force on the day the rental completes (the database date, UTC); the
booking keeps that version's id, and a completed booking that is calculated again (its period or
rate changed) uses the version it kept, so completed rentals keep the terms they were calculated
with. `public.booking_shares(gross, partner_percent)` gives the partner share as `round(gross x
percent / 100, 2)` (half away from zero; rounding is open, spec Q1) and the platform share as the
rest, so the two always add up to the gross revenue to the cent. Only the standard partner share is
used; the launch share and credit (VI-F04-S06) are not applied. A partner with no terms in force
gets the gross revenue, no shares and `revenue_flag = 'no_terms'` (the default of 30 and 70 is not
used); a rental with no duration gets no gross and no shares. The trigger function is `SECURITY
DEFINER` (the caller may not read the terms). A booking completed before this migration is not
calculated again. Rollback SQL is at the top of the migration.

**Adjustments (VI-F04-S10, migration `20261111090000_booking_adjustments.sql`).** `booking_adjustments`
is the financial history of a booking: `id`, `booking_id` (FK restrict), `type` (enum
`booking_adjustment_type`: `partial_refund`, `full_refund`, `manual_adjustment`, `chargeback`), `amount`
(`numeric(12,2)`, above zero), `reason` (required, at most 1000 characters), `created_by` (FK to users,
set null if the user is deleted) and `created_at`. It is append only (R16): triggers refuse UPDATE,
DELETE and TRUNCATE for every role, the service role included, and there is no insert, update or delete
policy, so a row is written only by `public.add_booking_adjustment(booking, type, amount, reason)`.
RLS: admin and operations manager read all; a partner user reads the adjustments of the bookings of its
own partner; a technician reads none. `add_booking_adjustment()` is `SECURITY DEFINER`: it checks that
the caller is an active admin or operations manager, locks the booking, requires a completed rental with
revenue left, an amount above zero with at most 2 decimals and not above the gross revenue the booking
has now, and a reason; it writes the row and updates `adjustments_total`, which makes the completion
trigger calculate the booking again in the same transaction. Error codes: `42501` not allowed, `P0002`
booking not found, `22023` a value is missing, `BA002` amount, `BA003` amount above the gross revenue,
`BA004` no revenue to adjust, `BA005` reason. The calculation: gross revenue = paid days x daily rate +
`adjustments_total`, never below zero; the shares are the split of that gross revenue with the terms the
booking kept; the launch credit is worked out on what the rental earned and does not change (spec Q4 is
open). All four types take money away (`booking_adjustment_sign()`; an assumption, the spec does not say
which way a manual adjustment goes). A change of the period or the rate afterwards keeps the adjustments.
Rollback SQL is at the top of the migration.

**Early return, cancellation and no-show (VI-F04-S07, migration `20261110090000_booking_revenue_cases.sql`).**
`revenue_case` keeps the case that priced the booking. A booking that becomes `cancelled` or `no_show`
(a trigger that runs after the booking guard) gets paid days 0, gross revenue 0.00, both shares 0.00,
no launch credit and no terms used: they are not charged. That rule is `public.booking_case_revenue()`
and is an assumption while spec Q3 is open. A rental that is completed is charged up to
`coalesce(actual_return_at, return_at)`, with the rule of the six-day cap: if it was returned before
`return_at` the case is `early_return`, otherwise `standard` (a later return is charged for the time it
really lasted, still up to 6 days). A return at the pickup is a rental with no duration
(`invalid_duration`). Changing `actual_return_at` of a completed booking calculates it again.
`revenue_case` and `actual_return_at` can only be changed in the booking functions. Refunds and
chargebacks are not handled (VI-F04-S09 to S11). Rollback SQL is at the top of the migration.

**Launch credit (VI-F04-S06, migration `20261109090000_launch_credit.sql`).** Launch terms are active
for a partner while its terms in use have a `launch_credit_target` and the balance has not reached
it; setting a target turns launch on and reaching it turns it off (there is no switch). The balance
of a partner is the sum of `launch_credit` over its completed bookings, and that sum is the truth.
While launch is active, a completed rental gets the launch share (`launch_partner_share_percent`)
instead of the standard share, and the extra, the launch share of the gross revenue minus the
standard share of it, is the launch credit of that rental. Once the balance is at the target or
above, every later rental uses the standard share. The rental that crosses the target (spec Q6 is
open, assumption) follows the terms at its completion: it gets the launch share in full, and the
balance after it may be above the target; it is recorded in `launch_credit_balance`. The trigger
locks the partner row before it reads the balance, so completions of one partner are calculated one
after the other (E4). A completed booking calculated again is replayed at its own place (balance
before = balance after - its credit), and the bookings completed after it are not calculated again.
On the version of the terms in use, `launch_credit_accumulated` and `launch_mode` are a copy for
display of the balance, refreshed after every completion, and `set_partner_commercial_terms()` sets
`launch_mode` of a new version from the target and the balance carried over. A refund or a
chargeback does not change the launch credit (spec Q4 is open). Rollback SQL is at the top of the
migration.

**F11 additions** (`20261002070734_booking_numbering_event_log_and_guards.sql`,
`20261002070738_booking_rpcs.sql`): sequence `public.booking_number_seq`
(starts at 21; the seed uses `BK-00001..BK-00020`) and
`public.generate_booking_number()` returning `'BK-' || 5-digit padded
number`. Triggers on `bookings`: `record_bookings_event_insert` and
`record_bookings_event_update` (function `record_booking_event()`, writes
`booking_events`) and `guard_bookings_update` (function
`guard_booking_update()`, see `docs/security.md` F11). Functions:
`create_booking`, `update_booking`, `change_booking_status`,
`get_available_seats`, `assert_booking_seat_assignable`. VI-F03-S03 adds
`create_partner_booking`, `update_partner_booking` (callable by signed-in
partner users, `SECURITY DEFINER`, see `docs/security.md`) and the internal
`partner_booking_free_seats`, `current_partner_user_partner_id`. Seed inserts now
also produce one `created` event per booking (`user_id` null). Rollback SQL
is in a comment at the bottom of each migration file.

### `booking_events` (immutable log)
| column | type | notes |
|---|---|---|
| booking_id | uuid not null, FK → bookings.id ON DELETE RESTRICT | |
| seat_id | uuid, FK → seats.id ON DELETE SET NULL | nullable |
| user_id | uuid, FK → users.id ON DELETE SET NULL | nullable |
| from_status | booking_status | nullable |
| to_status | booking_status not null | |
| notes | text | nullable |
| metadata | jsonb | nullable |

Indexes: `booking_id`, `created_at`.

**F11**: the table has no `event_type` column; the type is stored in
`metadata.event_type` (`created`, `updated`, `status_changed`,
`seat_changed`). `updated` events carry `metadata.changes` as
`{field: {from, to}}`; `seat_changed` carries `from_seat_id`/`to_seat_id`.
Because `to_status` is NOT NULL, `updated` and `seat_changed` events repeat
the current status. The table is append-only for every role (trigger) and
has no INSERT policy: rows are written only by `record_booking_event()`.

### `technician_jobs` (mutable)
| column | type | notes |
|---|---|---|
| booking_id | uuid not null, FK → bookings.id ON DELETE RESTRICT | |
| technician_id | uuid not null, FK → users.id ON DELETE RESTRICT | |
| assigned_at | timestamptz not null default now() | |
| started_at / completed_at | timestamptz | nullable |
| vehicle_bay | text | nullable |
| status | technician_job_status not null default 'assigned' | |
| installation_notes | text | nullable |
| job_type | technician_job_type not null default 'installation' | `installation`, `cleaning`, `inspection` |

Indexes: `technician_id`, `status`, `booking_id`, unique
`(booking_id, job_type)` where status is `assigned` or `in_progress`.

Insert guard trigger `guard_technician_jobs_insert`: the technician must be
an active `technician` user (`JB001`) and the booking must be active
(`JB002`).

### `technician_job_events` (immutable log)
| column | type | notes |
|---|---|---|
| technician_job_id | uuid not null, FK → technician_jobs.id ON DELETE RESTRICT | |
| user_id | uuid, FK → users.id ON DELETE SET NULL | who made the change |
| from_status | technician_job_status | nullable |
| to_status | technician_job_status not null | |
| from_technician_id / to_technician_id | uuid, FK → users.id ON DELETE SET NULL | assignee before and after |
| notes | text | reason (required to cancel) |
| created_at | timestamptz not null default now() | |

Index: `(technician_job_id, created_at)`. Written only by the
`record_technician_jobs_event_update` trigger on `technician_jobs` when
`status` or `technician_id` changes. Status changes use
`change_technician_job_status(job, from_status, to_status, reason)`.

### `installations` (immutable log)
| column | type | notes |
|---|---|---|
| technician_job_id | uuid not null, FK → technician_jobs.id ON DELETE RESTRICT | |
| seat_verified / category_verified / installation_completed | boolean not null default false | |
| vehicle_location / photo_path / notes | text | nullable |
| completed_at | timestamptz | nullable; the installation time |
| created_by | uuid, FK → users.id ON DELETE SET NULL | nullable; set by the guard trigger |
| seat_id | uuid, FK → seats.id ON DELETE RESTRICT | nullable (rows that predate it); set by the guard trigger from the booking's seat |

Unique index `(technician_job_id)`: one installation per job. Insert guard
trigger `guard_installations_insert`: the job must be an `installation` job
(`JB005`) and active (`JB006`), the booking must have a seat that is
`available` or `reserved` (`JB007`), and `completed_at` cannot be in the
future (`22023`). It also sets `seat_id` and `created_by`.

The log is immutable: no UPDATE/DELETE policy, and `UPDATE`, `DELETE` and
`TRUNCATE` are revoked from `anon` and `authenticated`.

### `cleaning_records` (immutable log)
| column | type | notes |
|---|---|---|
| seat_id | uuid not null, FK → seats.id ON DELETE RESTRICT | |
| booking_id | uuid, FK → bookings.id ON DELETE SET NULL | nullable — cleaning can occur outside a booking context |
| employee_id | uuid not null, FK → users.id ON DELETE RESTRICT | |
| started_at | timestamptz not null | |
| completed_at | timestamptz | nullable |
| checklist | jsonb | nullable |
| passed | boolean | nullable |
| notes / photo_path | text | nullable |
| technician_job_id | uuid, FK → technician_jobs.id ON DELETE RESTRICT | nullable (rows that predate it, cleaning outside a job); the job the cleaning was recorded for |

Cleaning is two steps (FO-F03-S04): `start_cleaning(job)` creates the record
with `started_at = now()` and no `completed_at`, and moves the seat to
`cleaning`; `complete_cleaning(job, passed, notes)` fills `completed_at`,
`passed` and `notes` once and moves the seat to `available` or `quarantine`.
`INSERT` is revoked from `anon` and `authenticated`; the functions are the only
way to create a record. See `docs/security.md` for the rules and error codes.

Unique index `(technician_job_id)`: one cleaning record per job. Insert guard
trigger `guard_cleaning_records_insert`: when a job is given, it must be a
`cleaning` job (`JB005`) and active (`JB006`), the booking must have a seat
that is not `retired` (`JB007`), and `completed_at` is required and cannot be
in the future (`22023`). It sets `seat_id`, `booking_id`, `employee_id` and
`started_at` (= `completed_at`, the form has one time). Rows without a job are
not checked. A `fail` result also moves the seat to `quarantine` (FO-F04-S05,
`20261026090000_inspection_follow_up.sql`; see `docs/security.md`). The technician insert policy requires the job to be assigned to
the caller.

The log is immutable: no UPDATE/DELETE policy, and `UPDATE`, `DELETE` and
`TRUNCATE` are revoked from `anon` and `authenticated`.

### `inspection_records` (immutable log)
| column | type | notes |
|---|---|---|
| seat_id | uuid not null, FK → seats.id ON DELETE RESTRICT | |
| booking_id | uuid, FK → bookings.id ON DELETE SET NULL | nullable |
| inspector_id | uuid not null, FK → users.id ON DELETE RESTRICT | |
| inspection_type | text not null | free text, not an enum |
| result | inspection_result not null | |
| checklist | jsonb | nullable |
| notes / photo_path | text | nullable |
| technician_job_id | uuid, FK → technician_jobs.id ON DELETE RESTRICT | nullable (rows that predate it, inspections outside a job); the job the inspection was recorded for |
| follow_up | text, check in (`seat_quarantined`, `seat_quarantined_active_booking`) | nullable; set only by the insert guard: what happened to the seat when a failed inspection was recorded |

Unique index `(technician_job_id)`: one inspection record per job. Insert guard
trigger `guard_inspection_records_insert`: when a job is given, it must be an
`inspection` job (`JB005`) and active (`JB006`), and the booking must have a
seat that is not `retired` (`JB007`). It sets `seat_id`, `booking_id`,
`inspector_id` and `inspection_type` (`general`). Rows without a job are not
checked. The technician insert policy requires the job to be assigned to the
caller, and the technician select policy also covers the record of a job
assigned to them.

The log is immutable: no UPDATE/DELETE policy, and `UPDATE`, `DELETE` and
`TRUNCATE` are revoked from `anon` and `authenticated`.

### `incidents` (mutable)
| column | type | notes |
|---|---|---|
| partner_id | uuid not null, FK → partners.id ON DELETE RESTRICT | |
| booking_id | uuid, FK → bookings.id ON DELETE SET NULL | nullable |
| seat_id | uuid, FK → seats.id ON DELETE RESTRICT | nullable; a seat an incident refers to cannot be deleted (it is retired instead) |
| technician_job_id | uuid, FK → technician_jobs.id ON DELETE SET NULL | nullable |
| type | text not null | |
| severity | incident_severity not null | |
| status | incident_status not null default 'open' | |
| description | text not null | |
| reported_by | uuid not null, FK → users.id ON DELETE RESTRICT | |
| resolved_by | uuid, FK → users.id ON DELETE SET NULL | nullable |
| resolved_at | timestamptz | nullable |

Indexes: `partner_id`, `status`.

Insert guard trigger `guard_incidents_insert` (FO-F05-S04): when
`technician_job_id` is given, it derives `booking_id`, `seat_id` and
`partner_id` from the job, sets `type` to the job type and `reported_by` to the
caller, and opens the incident (`status` open, no resolver). A technician who
is not assigned to the job gets `P0002`. The technician insert policy requires
an active technician and a job assigned to them. See `docs/security.md`.

Status guard trigger `guard_incidents_status_update` (FO-F05-S06): `status`,
`resolved_by` and `resolved_at` change only inside
`change_incident_status(incident_id, from_status, to_status, note)`; a direct
update is rejected with `55000`. See `docs/security.md`.

### `incident_status_history` (immutable log)
| column | type | notes |
|---|---|---|
| incident_id | uuid not null, FK → incidents.id ON DELETE RESTRICT | |
| user_id | uuid, FK → users.id ON DELETE SET NULL | who changed the status |
| from_status | incident_status | nullable |
| to_status | incident_status not null | |
| notes | text | nullable; required to reopen |
| created_at | timestamptz not null default now() | |

Index `(incident_id, created_at)`. Written by a trigger on `incidents`; the log
is append-only (no insert, update or delete, service role included), so an
incident with history cannot be deleted. Admin and operations manager read it.

### `partner_commercial_terms` (mutable, kept as versions)
| column | type | notes |
|---|---|---|
| partner_id | uuid not null, FK → partners.id ON DELETE RESTRICT | |
| partner_share_percent | numeric(5,2) not null default 30 | `check (0–100)` |
| platform_share_percent | numeric(5,2) not null default 70 | `check (0–100)`; with the partner share it adds up to 100 (`shares_sum_check`) |
| launch_partner_share_percent | numeric(5,2) not null default 50 | `check (0–100)`; not below the partner share (VI-F04-S01) |
| launch_mode | boolean not null default false | |
| launch_credit_target | numeric(12,2) | nullable (empty: no target set); `check (null or >= 0)` (VI-F04-S02) |
| launch_credit_accumulated | numeric(12,2) default 0 | nullable |
| annual_fee | numeric(12,2) not null default 0 | `check (>= 0)`; the annual programme fee |
| onboarding_fee | numeric(12,2) not null default 0 | `check (>= 0)`; shown as "Onboarding credit" |
| vat_rate_percent | numeric(5,2) not null default 0 | `check (0–100)`; only the rate is kept, how it is applied is open (spec Q2) |
| payment_terms_days | integer not null default 14 | `check (0–3650)`; days until an invoice is due |
| effective_from | date not null | |
| effective_to | date | nullable; not before `effective_from`; the last day the terms apply |

No indexes beyond the primary key (none required by the spec).

**Versions (VI-F04-S01).** The terms of a partner are rows with an effective period, not one row
that is edited. `public.set_partner_commercial_terms(partner, partner_share, launch_share,
effective_from)` (admin only) adds a new row and closes the latest one the day before the new one
starts, in one transaction, with the partner row locked so two saves cannot overlap. The date is
today or later (the date of the database server, UTC) and after the start of the latest version.
A `BEFORE UPDATE` trigger (`guard_partner_commercial_terms_update`) refuses a change to the
partner, the three shares, the launch credit target, the two fees, the VAT rate, the payment terms
or `effective_from` of a row (SQLSTATE `55000`), for any role including the service role;
`effective_to`, `launch_mode` and `launch_credit_accumulated` can still be updated. There is no
delete policy, so no role deletes a version. The function takes all the terms (nine arguments,
VI-F04-S02) and writes them to the new version; only `launch_mode` and the launch credit balance
are copied from the previous one. Error codes: `42501` not an admin, `P0002` partner not found,
`22023` a value is missing, `TC001` partner share, `TC002` launch share, `TC003` date in the past,
`TC004` date not after the latest version, `TC005` launch credit target, `TC006` annual fee or
onboarding credit, `TC007` VAT rate, `TC008` payment terms. Rollback SQL is at the top of each
migration.

### `settlements` (mutable)
| column | type | notes |
|---|---|---|
| partner_id | uuid not null, FK → partners.id ON DELETE RESTRICT | |
| period_start | date not null | |
| period_end | date not null | `check (period_end >= period_start)` |
| gross_revenue / partner_share / platform_share / refunds / adjustments / launch_credit / final_amount | numeric(12,2) not null default 0 | |
| status | settlement_status not null default 'draft' | |

Index: `partner_id`.

### `invoices` (mutable)
| column | type | notes |
|---|---|---|
| partner_id | uuid not null, FK → partners.id ON DELETE RESTRICT | |
| settlement_id | uuid, FK → settlements.id ON DELETE RESTRICT | nullable |
| invoice_number | text not null unique | |
| issue_date / due_date | date not null | |
| subtotal / total | numeric(12,2) not null | |
| vat | numeric(12,2) not null default 0 | |
| status | invoice_status not null default 'draft' | |
| pdf_path | text | nullable |

Indexes: `partner_id`, `status`.

### `ai_queries` (immutable log)
| column | type | notes |
|---|---|---|
| partner_id | uuid, FK → partners.id ON DELETE SET NULL | nullable |
| user_id | uuid, FK → users.id ON DELETE SET NULL | nullable |
| question | text not null | |
| intent | text | nullable |
| query_result | jsonb | nullable |
| answer | text | nullable |

No indexes beyond the primary key. Treated as a low-stakes analytics/log
table (not operational or financial), so both its FKs use `SET NULL`
instead of the stricter `RESTRICT` convention applied elsewhere.

## Relationships and `ON DELETE` policy

No `ON DELETE CASCADE` is used anywhere in this schema. Two buckets only:

- **`RESTRICT`** — every FK that anchors an audit/financial/inventory
  record to its owning entity (`partners`, `airports`, `seat_categories`,
  `seats`, `bookings`, `technician_jobs`, `settlements`), and every
  "core accountability" actor FK (`employee_id`, `inspector_id`,
  `technician_id`, `reported_by`). These parent rows can never be
  hard-deleted while children reference them — partners/seats/bookings
  are meant to be deactivated via their `status` column, never hard
  deleted. This makes accidental loss of historical/audit data
  structurally impossible rather than merely discouraged.
- **`SET NULL`** — optional assignment/reference FKs where the child
  record's identity doesn't depend on the referenced row surviving:
  `bookings.assigned_seat_id`, `bookings.assigned_technician_id`,
  `bookings.flight_id`, `booking_events.seat_id`, `booking_events.user_id`,
  `installations.created_by`, `cleaning_records.booking_id`,
  `inspection_records.booking_id`, `incidents.booking_id`,
  `incidents.technician_job_id`,
  `incidents.resolved_by`, `ai_queries.partner_id`, `ai_queries.user_id`.

**Practical consequence**: because almost every core table uses
`RESTRICT`, a partner/airport/seat/booking/etc. effectively cannot be
hard-deleted once it has any child row — which happens almost
immediately in practice. Any future "delete a test partner" admin
tooling must go through the `status` soft-delete columns, not a real
`DELETE` statement.

## Money and percentage conventions

- All currency fields use `numeric(12,2)` — never `float`/`double
  precision` — based on AED (2 decimal places) being the seeded
  currency. A future currency needing 3 decimals would require a
  migration, not a code fix.
- Percentage fields (`partner_share_percent`, `platform_share_percent`)
  use `numeric(5,2)` with a `check (>= 0 and <= 100)` constraint each.
  They are not constrained to sum to 100.

## Migration strategy

One migration per table, in strict FK-dependency order, preceded by a
single shared migration for extensions/enums/the trigger helper:

```
20260826083733_create_enums_and_extensions.sql
20260826083744_create_partners_table.sql
20260826083747_create_airports_table.sql
20260826083750_create_seat_categories_table.sql
20260826083752_create_users_table.sql
20260826083755_create_seats_table.sql
20260826083758_create_seat_status_history_table.sql
20260826083800_create_flights_table.sql
20260826083803_create_bookings_table.sql
20260826083806_create_booking_events_table.sql
20260826083809_create_technician_jobs_table.sql
20260826083811_create_installations_table.sql
20260826083814_create_cleaning_records_table.sql
20260826083816_create_inspection_records_table.sql
20260826083819_create_incidents_table.sql
20260826083822_create_partner_commercial_terms_table.sql
20260826083824_create_settlements_table.sql
20260826083827_create_invoices_table.sql
20260826083829_create_ai_queries_table.sql
20260828065217_redefine_user_role_enum.sql
20260902085338_enable_rls_multi_tenancy.sql
```

The second-to-last entry is an `F04 — RBAC` follow-up migration, not part
of the original F02 table set — see the `user_role` note above. The last
entry is `F05 — Multi-tenancy + RLS` (see the "Row Level Security" section
below) — one migration for the whole feature rather than one-per-table,
since it only adds to existing tables and creates none.

Rationale:
- Matches the `.claude/skills/db-migration/SKILL.md` convention (one
  table per migration).
- Keeps each diff small and independently reviewable/bisectable — a
  mistake in one table's constraints doesn't force re-review of an
  18-table monolith.
- Ordering by dependency layer (rather than alphabetically or ticket
  order) means every migration only references tables that already
  exist when it runs, so `npx supabase db reset` replays start to finish
  with no FK/ordering errors.

Every table migration's trailing comment block records the rollback
(`drop table` / `drop trigger` / `drop index`, and for 0001, `drop type`
/ `drop function` / `drop extension`) — per the db-migration skill's
convention, adapted here since no RLS policies exist to drop.

`enable row level security` plus `create policy` statements for all 18
tables live in `20260902085338_enable_rls_multi_tenancy.sql` (`F05`) —
see the "Row Level Security" section below.

## Row Level Security (F05)

`20260902085338_enable_rls_multi_tenancy.sql` enables RLS and adds
`select`/`insert`/`update` policies to every table above (no `delete`
policy exists anywhere — see "No DELETE policy" below). Full per-table
access rules live in `docs/security.md`'s F05 section; this section
covers only what's specific to the schema.

**Ownership relationships used by RLS** — tables below do not carry
`partner_id` directly and are scoped by joining through another table:

| table | ownership path | notes |
|---|---|---|
| `booking_events` | `booking_id → bookings.partner_id` | also joins `bookings`/`technician_jobs` for technician visibility |
| `technician_jobs` | `booking_id → bookings.partner_id` (via `booking_partner_id()`, not a direct join — see below) | `technician_id` is the direct actor FK |
| `installations` | `technician_job_id → technician_jobs.technician_id` (actor) and `→ technician_jobs.booking_id → bookings.partner_id` (partner visibility) | two-hop join for `partner_user` |
| `cleaning_records` | `booking_id → bookings.partner_id`, nullable | `employee_id` is the direct actor FK; a null `booking_id` row is invisible to every `partner_user` |
| `inspection_records` | `booking_id → bookings.partner_id`, nullable | same shape as `cleaning_records`, `inspector_id` is the actor FK |
| `incidents` | `partner_id` is direct, not joined | `booking_id` (if present) must reference a booking with a matching `partner_id` — enforced by a `with check` on both INSERT policies |
| `seats` | `bookings.assigned_seat_id`, no direct `partner_id`/technician FK | technician/partner_user visibility both go through `bookings` |

**RLS recursion note**: `bookings`' technician-visibility policy queries
`technician_jobs`, and `technician_jobs`' `partner_user`-visibility policy
needs `bookings.partner_id`. Doing the latter as a plain
`exists (select ... from bookings ...)` re-triggers `bookings`' own RLS
policies, which query `technician_jobs` again — Postgres reports this as
`42P17 infinite recursion detected in policy`. The migration breaks this
with a fifth `SECURITY DEFINER` helper, `booking_partner_id(uuid)`, that
reads `bookings.partner_id` bypassing `bookings`' RLS, the same mechanism
already used for `current_user_role()`/`current_user_partner_id()` reading
`public.users` from inside that table's own policies.

**New indexes added by F05** (supporting the `exists(...)` ownership joins
above; everything else needed already existed from F02):

- `installations_technician_job_id_idx` on `installations(technician_job_id)`
- `cleaning_records_employee_id_idx` on `cleaning_records(employee_id)`
- `cleaning_records_booking_id_idx` on `cleaning_records(booking_id)`
- `inspection_records_inspector_id_idx` on `inspection_records(inspector_id)`
- `inspection_records_booking_id_idx` on `inspection_records(booking_id)`
- `incidents_reported_by_idx` on `incidents(reported_by)`
- `ai_queries_user_id_idx` on `ai_queries(user_id)`

**No DELETE policy** exists on any table for any role — consistent with
the `RESTRICT`-everywhere / soft-delete-via-`status` convention documented
above. The absence of a matching policy means RLS denies every `DELETE`
by default.

**Caution**: `airports`, `seat_categories`, and `flights` have a
`select ... to authenticated using (true)` policy — deliberate for shared
reference data with no partner/financial/personal fields today. A future
column added to one of these tables silently inherits that broad
visibility; review this policy before adding anything sensitive to these
three tables.

## Seed strategy

`supabase/seed.sql` is applied automatically by `npx supabase db reset`
(followed by the demo seed, see "Demo data" below).
Every seeded row uses a **fixed literal UUID** — never a table's
`gen_random_uuid()` default — so repeated `db reset` runs produce
byte-identical ids every time. Ids are grouped by a fixed per-entity
prefix (e.g. `a0000000-…` for airports, `b0000000-…` for partners,
`e0000000-…` for seats) with a zero-padded sequence number, making the
seed script's FK references explicit and easy to trace by eye.

Seeded data:
- 1 airport — DXB (Dubai International)
- 2 partners — active status
- 4 seat categories — infant carrier, convertible, booster, all-in-one
- 3 technician users (`role = 'technician'`)
- 40 seats — generated via `generate_series`, cycling across the 4 seat
  categories and 3 manufacturers, all at the DXB airport
- 20 bookings — generated via `generate_series`, cycling across the 2
  partners, 4 seat categories, 3 technicians, and referencing the seeded
  seats 1:1 by sequence number

## Demo data (VI-F07-S01)

`npx supabase db reset` loads two seed files, in this order
(`[db.seed]` in `supabase/config.toml`): the base seed above, then
`supabase/seeds/demo.sql`, which adds an account for every role and the
operational flows a demo needs. The base seed is not changed by it.

**One command:**

```bash
npm run demo:reset    # resets the LOCAL database, loads both seeds, checks them
npm run demo:verify   # only runs the checks, on what is loaded
npm run demo:determinism   # resets twice and shows that both loads are the same
```

`demo:reset` replaces everything in the local database and refuses to run
against a database that is not local. If a load fails halfway, run it again: a
reset always returns to a clean state, and `demo.sql` is one statement, so it
keeps nothing of a load that fails (spec E3). When `demo:reset` fails it says so,
and tells you to run it again. `demo-guard.test.ts` keeps `demo.sql` one statement.

**Accounts.** All use the same public demo password, `DemoPassw0rd!`. It is a
demo value for a local database, not a credential: the script that loads it
refuses a non-local database, and `demo.sql` refuses to run next to an account
with a real address.

| Email | Role | Sees |
|---|---|---|
| `admin@airportops.example` | admin | everything |
| `ops.manager@airportops.example` | operations_manager | everything, and runs the bookings, jobs and incidents |
| `partner.dcr@airportops.example` | partner_user (Demo Car Rental, `DCR`) | only the bookings, seats and incidents of Demo Car Rental |
| `partner.dmo@airportops.example` | partner_user (Demo Mobility, `DMO`) | only the bookings, seats and incidents of Demo Mobility |
| `technician1@airportops.example` | technician | only their own jobs (also `technician2`, `technician3`) |

**What is in it.** On top of the base seed: ten more bookings `BK-00021` to
`BK-00030` (pending, in progress, completed, cancelled, no-show and confirmed),
eight technician jobs (installation, cleaning, inspection; assigned, in progress
and completed) with the installation, cleaning and inspection records of the
finished ones, a seat in quarantine after a failed inspection, and two incidents
(one open, one resolved by the operations manager). The next booking made in the
app is `BK-00031`.

**Rules the data follows.**
- *Coherence (R1).* Every reference is valid; a seat has the airport and category
  of its booking and no two active bookings share one for overlapping periods;
  numbers, serials and emails are unique; the history (booking events, seat
  history, job events, incident history) is written by the same triggers the app
  uses, by moving each record through its real statuses, so the last step of each
  history is the current status.
- *Same input, same data (R2).* Two loads give the same data in every column of
  every table, not only the same ids. The ids are fixed. The values the system
  would set are made fixed in the last step of `demo.sql`: `created_at` and
  `updated_at` of the seeded rows are `2026-08-01 00:00:00+00`; each audit row
  (booking events, seat history, job events, incident history) gets an id made
  from its table and its rank, and a time of that moment plus its rank in
  seconds, which keeps the order it happened in; the seats' public tokens, the
  identity ids and the password hash (a fixed salt) are made from fixed input.
  To do that, the step turns off the triggers of the tables it touches (the
  `updated_at` triggers and the immutability triggers of the audit tables) and
  turns them on again inside the same statement. It is all or nothing, it
  touches only the seeded rows, and a test checks that no trigger is left off.
- *Nothing real (R3).* No real personal, financial or credential data, and no
  real person or company. Every person and company of the seed is named as a demo
  one (`Demo Technician One`, `Demo Car Rental`, `Demo Mobility`...); every email
  ends in `.example`; the only credential is the public demo password, which is
  also the only value the checks allow. The airport (DXB) is a public place, not
  personal data. This is checked, not only promised, by
  `src/lib/demo/sensitive-data.ts`, which looks for: an email that is not a demo
  address, a phone number, an Emirates ID or SSN, a card number that passes the
  Luhn check and starts like a card, an IBAN that passes mod 97, a JWT, an API or cloud key, a private
  key, a full password hash, a password or secret written in the text, a long
  secret-looking token, and a link to a host that is not a demo or local one. It
  runs on the text of both seed files (with every `npm test`) and on every column
  of every seeded row once loaded (`demo:verify`), including the Auth accounts; a
  test plants real-looking data and shows that it is caught. A new table must be
  added to the scan or to the list of tables the seed leaves empty, or the check
  fails. A new demo value that is public on purpose is added to the allowed list
  in the test, with a reason. The demo accounts cannot read the `auth` schema (the
  password hashes), no public table has a password, secret or hash column, and a
  partner account sees only its own partner's contact details.
- *Roles and isolation (R4).* One account per role and two partners, each with
  its own bookings, so the isolation can be shown.
- *Honest figures (R5).* Nothing on a dashboard is stored: the figures are counted
  from these rows when the page loads. `demo-honest-metrics.integration.test.ts`
  (VI-F07-S05) signs in as each demo account and compares every figure with a
  count made another way: the rows read with the service role, in the scope of
  that role. The two must be equal. The same figure has different values for
  different accounts, and the two partners add up to the operations manager's,
  so no fixed number could pass. A real 0 (critical open incidents) is shown as 0.
- *Real data (E1, VI-F07-S06).* Both `seed.sql` and `demo.sql` stop with an error,
  before they insert anything, if any account (profile or Auth) has an address that
  is not `.example` or `@test.local`. The base seed is guarded as well because it
  runs first and would otherwise put demo airports, partners, seats and bookings
  next to real data. Loading by hand, use `psql -v ON_ERROR_STOP=1 -f ...`, or psql
  goes on with the next statement after the error. The guard is a check in SQL, so
  it stops a mistake, not someone with access to the database who means to get
  round it. Which environments may receive demo data stays local only (spec Q3).
- *Loaded again (E2).* Both files can be run again on a database that already
  has them. Every insert of `seed.sql` is `on conflict (id) do nothing`, and
  `demo.sql` prints "already loaded" and stops. Nothing fails, nothing is added,
  nothing is changed. A seeded row that was changed or deleted since is **not**
  put back by a rerun: only `npm run demo:reset` (a reset) does that.

**Proof that two loads are the same.**

```bash
npm run demo:determinism   # resets the LOCAL database twice and compares
```

After each reset it takes a fingerprint of 22 tables (`scripts/demo-fingerprint.sql`:
the row count and an md5 of every column of every row, in an order that does not
depend on where the rows are stored, with nothing left out) and the two must be
equal; if not, it prints the tables that differ. It takes about a minute and
replaces the local database, so it is not part of `npm test`. What does run with
`npm test`: the seed files hold no random number, uuid generator or clock, every
insert of the base seed can be run again, and a rerun of both seeds on the loaded
database changes no column of any seeded row.

**Every role has records, and the history says who did what (VI-F07-S04).**
Each step of the seed is done as the person who would do it: it sets
`request.jwt.claim.sub`, which is what `auth.uid()` reads, so the triggers write
that person as the actor of the event, and the actors are constants (two loads
stay equal). Partner users make their pending requests; the operations manager
confirms and completes bookings, and looks into and resolves incidents; the admin
marks a no-show; each technician starts and completes their own jobs, records the
installation, cleaning or inspection, and reports incidents. The 20 bookings of
the base seed and the 40 seats' first status have no actor (the system made them).

| Account | Sees (of the seeded records) | Did |
|---|---|---|
| admin, operations manager | every booking, seat, job, record of the work, incident and history, both partners, all seven demo users | operations: confirms, completes, resolves an incident; admin: marks a no-show |
| partner user (each partner) | its own partner's bookings and their events, the seats on them, the jobs and installation, cleaning and inspection records on them, its own incidents, its own partner and its own user. No seat history, job events or incident history. | its own pending request |
| technician (each) | its own jobs and their events, the bookings and seats of those jobs, its own records of the work, the incidents it reported or that are on its jobs, its own user. No partner row. | starts and completes its jobs, records the work, reports incidents |

The two partners have different data on purpose, so the isolation shows: Demo Car
Rental has a resolved incident and Demo Mobility an open one with a seat in
quarantine; each has bookings in every state a demo needs. The operations manager
sees the name of whoever did each step of a timeline; a partner user sees only
their own name there. The two partners have agreed terms (30% and 35% for the partner, from 1 January 2026), so the two
completed rentals have their shares. Demo Car Rental is in its launch period (a target of 1000 and a
launch share of 50%), so its completed rental has 54.00 of launch credit; Demo Mobility has no
target. Settlements and invoices have no records: they wait for the
later stories of VI-F04. To see the "Access denied" screens, make the state
by hand in the local database (for example, take the partner off a partner user's
profile, or suspend a partner) and reset to put it back.

The checks are `src/lib/demo/demo-data.integration.test.ts`: they cover the rules
above, that each account signs in, what each role sees, and the two guards.

## Types

`src/types/database.types.ts` is generated from the local schema via:

```bash
npx supabase gen types typescript --local > src/types/database.types.ts
```

Regenerate and commit this file in the same change as any future
migration — it must never drift from the schema.
