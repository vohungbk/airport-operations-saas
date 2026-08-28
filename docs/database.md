# Database

This is the schema reference for `F02 — Database Foundation`. It covers
the enums, tables, relationships, indexes, migration strategy, and seed
data delivered by F02. See `plan.md` (F02) for the full task-by-task
rationale this document summarizes.

> **RLS IS NOT YET ENABLED. Read this before querying any table below
> from application code.**
>
> No table created in F02 has Row Level Security enabled and no policies
> exist. RLS is deliberately deferred to `F05 — Multi-tenancy + RLS`,
> which lands after `F03 Authentication` and `F04 RBAC`. Until F05 ships:
>
> - **No Server Action, Route Handler, or Server Component may query any
>   table listed here from real user-facing code.** There is currently
>   nothing in the database enforcing tenant isolation — a query issued
>   with the anon/publishable key (or any authenticated session) can read
>   or write any partner's rows.
> - Every partner-owned table was designed with an unambiguous
>   `partner_id` or FK-traceable ownership path back to `partners` so
>   that F05 can add `enable row level security` + policies cleanly
>   later, without a schema rework. That path existing is not the same
>   as isolation existing — isolation only exists once F05's policies are
>   applied.
> - This is a documented, scoped exception to this project's normal
>   convention (`.claude/skills/db-migration/SKILL.md` normally bundles
>   RLS into the same migration as the table), not an oversight.

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
| public_token | text not null unique default gen_random_uuid()::text | placeholder format; real QR-token format is an F10 decision |
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
| paid_days | integer not null default 0 | `check (>= 0)` |
| gross_revenue / partner_share / platform_share | numeric(12,2) | nullable — computed later by F22 |
| status | booking_status not null default 'pending' | |
| incident_status | incident_status | nullable |
| notes | text | nullable |

Indexes: `partner_id`, `status`, `pickup_at`, `return_at`,
`assigned_seat_id`, `assigned_technician_id`, `flight_id`.

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

Indexes: `technician_id`, `status`, `booking_id`.

### `installations` (immutable log)
| column | type | notes |
|---|---|---|
| technician_job_id | uuid not null, FK → technician_jobs.id ON DELETE RESTRICT | |
| seat_verified / category_verified / installation_completed | boolean not null default false | |
| vehicle_location / photo_path / notes | text | nullable |
| completed_at | timestamptz | nullable |
| created_by | uuid, FK → users.id ON DELETE SET NULL | nullable |

No indexes beyond the primary key (none required by the spec).

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

### `incidents` (mutable)
| column | type | notes |
|---|---|---|
| partner_id | uuid not null, FK → partners.id ON DELETE RESTRICT | |
| booking_id | uuid, FK → bookings.id ON DELETE SET NULL | nullable |
| seat_id | uuid, FK → seats.id ON DELETE SET NULL | nullable |
| technician_job_id | uuid, FK → technician_jobs.id ON DELETE SET NULL | nullable |
| type | text not null | |
| severity | incident_severity not null | |
| status | incident_status not null default 'open' | |
| description | text not null | |
| reported_by | uuid not null, FK → users.id ON DELETE RESTRICT | |
| resolved_by | uuid, FK → users.id ON DELETE SET NULL | nullable |
| resolved_at | timestamptz | nullable |

Indexes: `partner_id`, `status`.

### `partner_commercial_terms` (mutable)
| column | type | notes |
|---|---|---|
| partner_id | uuid not null, FK → partners.id ON DELETE RESTRICT | |
| partner_share_percent | numeric(5,2) not null | `check (0–100)` |
| platform_share_percent | numeric(5,2) not null | `check (0–100)`; not constrained to sum to 100 (plan.md open question 6 — not requested) |
| launch_mode | boolean not null default false | |
| launch_credit_target | numeric(12,2) | nullable |
| launch_credit_accumulated | numeric(12,2) default 0 | nullable |
| annual_fee / onboarding_fee | numeric(12,2) | nullable |
| effective_from | date not null | |
| effective_to | date | nullable |

No indexes beyond the primary key (none required by the spec).

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
  `incidents.seat_id`, `incidents.technician_job_id`,
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
```

The last entry is an `F04 — RBAC` follow-up migration, not part of the
original F02 table set — see the `user_role` note above.

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

**No `enable row level security` and no `create policy` statements exist
anywhere in this migration set.** See the warning at the top of this
document.

## Seed strategy

`supabase/seed.sql` is applied automatically by `npx supabase db reset`.
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

## Types

`src/types/database.types.ts` is generated from the local schema via:

```bash
npx supabase gen types typescript --local > src/types/database.types.ts
```

Regenerate and commit this file in the same change as any future
migration — it must never drift from the schema.
