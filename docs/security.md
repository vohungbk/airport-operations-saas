# Security Principles

These are the security principles the project commits to. None are
implemented yet — this document exists so later tasks build against a
consistent policy rather than deciding it ad hoc.

## Authentication

- All authentication goes through Supabase Auth. No custom auth system.
- Session cookies are refreshed on every request by `src/proxy.ts`, which
  validates the token via `supabase.auth.getClaims()`.

### F03 — Email/password auth, profile sync, and route protection

- **Signup order is fixed**: `supabase.auth.signUp()` first, then a row
  is written to `public.users` keyed on the returned auth user id, via
  the shared `syncUserProfile()` helper
  (`src/features/auth/lib/sync-user-profile.ts`). The app never creates a
  `public.users` row before Supabase Auth confirms the auth user exists,
  and the write is an upsert-by-id so a signup interrupted between steps
  (e.g. a dropped request) can safely retry without leaving an orphaned
  or duplicate row.
  - **Updated by F05**: `syncUserProfile()` only runs where `auth.uid()`
    is guaranteed to be the real new user's id, since `F05`'s `users`
    RLS INSERT policy requires `id = auth.uid()`. When
    `supabase.auth.signUp()` returns a session immediately (email
    confirmation disabled), `signup.action.ts` calls it right there.
    When it does not (email confirmation enabled), `signup.action.ts`
    skips the write entirely — running it there would execute as `anon`
    with no `auth.uid()` and be rejected by RLS — and
    `api/auth/confirm/route.ts` calls `syncUserProfile()` instead, after
    `verifyOtp()` exchanges the confirmation token for a real session.
    `full_name` is carried from the signup form to that later request via
    `signUp()`'s `options.data` (Supabase Auth `user_metadata`), since the
    original request/closure no longer exists by the time the
    confirmation link is clicked.
- **Role assignment is server-only.** The signup Zod schema
  (`src/features/auth/schemas/signup.schema.ts`) has no `role` or
  `partner_id` field — the Server Action hardcodes `role:
  'partner_user'`, `partner_id: null` for every public signup. This is
  the least-privileged value in the `user_role` enum that doesn't
  require a partner assignment (`user_role` was finalized by F04, see
  below; the value was originally `partner_staff` under F02's
  provisional 4-value enum). No code path reads a role or partner id
  from client-supplied input during signup. Assigning a different role
  or a real `partner_id` (a user/role management feature) is out of
  scope for both F03 and F04, and remains deferred to a later feature.
- **Email confirmation is handled defensively, not assumed on/off.**
  `signup.action.ts` checks whether `supabase.auth.signUp()` returned a
  session: if it did (email confirmation disabled), the user is signed
  in immediately and redirected to `/dashboard`; if not, the UI shows a
  "check your email" message instead. This makes the flow correct
  regardless of the "Confirm email" setting in the Supabase project.
- **Anti email-enumeration.** A duplicate-email signup (whether
  Supabase reports it as an obfuscated `identities: []` user or as a
  `user_already_exists` error, depending on the "Confirm email"
  setting) is shown the exact same "check your email" message as a
  genuine new signup, and never triggers a `public.users` write.
  `forgot-password.action.ts` always returns the same generic success
  message regardless of whether the email exists.
- **Public vs. protected routes** are defined once, in
  `src/lib/constants/routes.ts`, and enforced server-side in
  `src/lib/supabase/proxy.ts` (`updateSession`) — an unauthenticated
  request to a non-public route is redirected to `/login`; an
  authenticated request to `/login` or `/signup` is redirected to
  `/dashboard`. Route protection is never enforced only in the client.
  - Public: `/`, `/login`, `/signup`, `/forgot-password`,
    `/reset-password`, `/api/auth/confirm`.
  - Everything else (e.g. `/dashboard`) requires an authenticated
    session. Server Components that render protected data additionally
    call `requireUser()` (`src/lib/auth/session.ts`) as a second,
    independent guard.
  - There is no public QR route. A QR scan only identifies a seat and opens
    a page behind sign in; it is never added to this public-routes list (PO
    Decision Log, PRD v1.1 section 20). See "Seat QR code" below.
- **`public.users` now has RLS**, added by `F05 — Multi-tenancy + RLS`
  (see that section below). The profile-write step described above only
  ever runs with a real, server-verified `auth.uid()` (either immediately
  after `signUp()` when email confirmation is disabled, or after
  `api/auth/confirm/route.ts` exchanges the confirmation token when it is
  enabled — see the "Updated by F05" note just above), which is exactly
  what the `users` INSERT policy requires.
- **Seeded technician rows** in `supabase/seed.sql` are plain database
  rows with no corresponding Supabase Auth user — they cannot sign in
  through this flow. Linking a real Auth user to a technician record is
  deferred to a later RBAC/technician feature; F03 does not touch the
  seed data.

### Supabase Dashboard configuration required for F03 (not done from the repo)

`/api/auth/confirm` (`src/app/api/auth/confirm/route.ts`) is the
callback that exchanges a signup-confirmation or password-recovery email
link for a session. For that link to work, the exact callback URL must
be added to the **Redirect URLs** allow-list in the Supabase project's
Auth settings (Dashboard → Authentication → URL Configuration). This is
an operational step outside the codebase — add:

- Local development: `http://localhost:3000/api/auth/confirm`
- Production: `https://<production-domain>/api/auth/confirm`

Until this is configured, `supabase.auth.signUp()` (with email
confirmation enabled) and `supabase.auth.resetPasswordForEmail()` will
still succeed, but the link in the resulting email will not be allowed
to redirect back into the app.

## Role-Based Access Control

- Access within a tenant is governed by roles. Roles are enforced
  server-side, not inferred from UI state.

### F04 — RBAC roles, permissions, and authorization layer

- **4 roles**, defined by the `user_role` Postgres enum
  (`supabase/migrations/20260828065217_redefine_user_role_enum.sql`,
  `src/lib/auth/roles.ts`): `admin`, `operations_manager`, `technician`,
  `partner_user`.
- **Permission model** (`src/lib/auth/permissions.ts`) — a fixed,
  string-literal `Permission` union, no permissions are invented beyond
  this table. `admin` is not listed explicitly: `hasPermission()`
  short-circuits `true` for `role === "admin"` before consulting the map,
  matching "full system access" without maintaining a duplicate list of
  every permission that gets added later.

  | role | permissions |
  |---|---|
  | `admin` | all (bypass, no explicit list) |
  | `operations_manager` | `airports:manage`, `partners:manage`, `seat_categories:manage`, `seats:manage`, `bookings:manage`, `technicians:manage`, `cleaning:manage`, `inspections:manage`, `incidents:view`, `finance:view`, `dashboards:view` |
  | `technician` | `jobs:view_assigned`, `jobs:update_assigned`, `installation:perform`, `cleaning:create`, `inspections:create`, `incidents:report` |
  | `partner_user` | `bookings:view_own_partner`, `bookings:manage_own_partner`, `seats:view_own_partner`, `operations:view_own_partner`, `finance:view_own_partner` |

- **Authorization-layer helpers** (`src/lib/auth/current-user.ts`), built
  on top of the existing JWT-only `getAuthUser()`/`requireUser()`
  (`src/lib/auth/session.ts`, unchanged since F03):
  - `getCurrentUser()` — verifies the JWT, then does a single self-lookup
    row read on `public.users` filtered by `.eq("id", authUser.id)`
    (never a list query). Returns `null` if there's no session, the row
    is missing, the query errors, or `is_active` is `false` — an
    inactive account with a still-live Supabase Auth session is rejected
    here, not left to the UI to filter. Wrapped in React's `cache()` so
    nested layouts (e.g. `(dashboard)` guarding, then `(admin)` guarding
    again) share one DB round trip per request.
  - `requireAuth()` — no session -> redirect `/login`; session but
    invalid/inactive/missing profile -> redirect `/forbidden`; otherwise
    returns the resolved `AppUser`.
  - `requireRole(allowed: Role[])` / `requirePermission(permission)` —
    built on `requireAuth()`, redirect to `/forbidden` unless
    `user.role === "admin"` or the role/permission check passes. The
    `admin` bypass is implemented **only** inside `hasPermission()` and
    `requireRole()`/`requirePermission()` — never re-implemented inline
    in a layout or page.
- **3-way unauthorized handling**:
  1. Not logged in -> `/login`.
  2. Logged in but not permitted (role/permission check fails) ->
     `/forbidden`.
  3. Logged in but the `public.users` profile is missing/inactive/invalid
     -> `/forbidden` too, with the same generic, non-leaking copy as
     case 2 — the page never confirms which of the two happened.
     `src/app/forbidden/page.tsx` deliberately does not call
     `requireAuth()` itself (that would risk a redirect loop for exactly
     the users it exists to serve); it only calls `getAuthUser()` to
     decide whether to show a logout link or a login link.
- **Partner isolation design principle.** `partner_user` access is
  designed around `users.partner_id`. A `null` `partner_id` (e.g. right
  after signup, see F03) means "no partner assigned yet -> safe empty
  state," never "unrestricted -> see all partners' data." This was a
  design principle enforced by convention as of F04; it is now a real,
  database-enforced boundary — `F05 — Multi-tenancy + RLS`'s
  `current_user_partner_id()` returns `null` for exactly this case, and a
  `partner_id = current_user_partner_id()` `USING` clause built on it
  evaluates to zero rows (never all rows) for a `null` comparison. See
  the F05 section below.
- **Route areas**: `(admin)/admin` gated by `dashboards:view`,
  `(technician)/technician` gated by `jobs:view_assigned`,
  `(partner)/partner` gated by `bookings:view_own_partner` — nav
  visibility (`src/config/nav.ts`) and the area's own layout/page guard
  reuse the exact same permission, so there's one source of truth for
  "can this role see this area," not a separate `*:access` permission
  invented for navigation.
- **`getCurrentUser()`'s self-lookup query on `public.users`** was
  originally safe without RLS because it is keyed by the caller's own
  server-verified id (`auth.uid()` from the validated JWT, never a
  client-supplied id) — the same reasoning F03 already relied on for the
  profile-sync upsert during signup. `public.users` now has RLS as of
  `F05 — Multi-tenancy + RLS` (its `users_select_self` policy matches this
  exact query shape), so this is now both a safe *and* an RLS-enforced
  read, not just a safe-by-convention one.

## Multi-Tenant Data Isolation

- Multi-tenancy is a database concern, not a frontend concern. Filtering
  data by tenant in a React component is not sufficient isolation and must
  never be relied on as the only safeguard.
- Every tenant-scoped table will be protected by Supabase Row Level
  Security so a query can only return rows the authenticated user's tenant
  is allowed to see, regardless of which client issued the query.

## PostgreSQL Row Level Security

- RLS is enabled by default on tenant-scoped tables from the moment they
  are created (`F05 — Multi-tenancy + RLS`).
- Policies are written and reviewed as part of the schema that introduces
  the table, not bolted on afterward.

### F05 — Multi-tenancy + RLS

`supabase/migrations/20260902085338_enable_rls_multi_tenancy.sql` turns
on Row Level Security for all 18 tables created by `F02`, making the
`Supabase Auth → Application User → Role → Partner Membership →
PostgreSQL RLS` chain a real, database-enforced boundary rather than a
convention `hasPermission()`/`requireRole()` alone provided. RLS is the
last line of defense: the UI/route guards from F03/F04 remain in place
unchanged, but the database now independently rejects anything they
might miss.

**Tenant model**: the tenant is `partners`. Membership is
`users.partner_id`, nullable for the three internal roles (`admin`,
`operations_manager`, `technician`), which are not tied to any single
partner. A `partner_user` with `partner_id is null` (e.g. immediately
after signup) sees zero rows everywhere partner-scoped, never an error
and never every partner's rows.

**Helper functions** — all `SECURITY DEFINER`, `STABLE`, `SET
search_path = ''` (every inner reference fully schema-qualified), with
`EXECUTE` explicitly revoked from `PUBLIC` and from `anon` and re-granted
only to `authenticated` (Postgres grants `EXECUTE` to `PUBLIC` by default
on function creation, and this Supabase project's `public` schema also
carries its own default privilege directly granting `anon`
`EXECUTE` on every new function — both had to be revoked, or `anon` could
call these functions directly):

| function | purpose |
|---|---|
| `current_user_role()` | The caller's role from `public.users`, or `null` if there is no session, the profile is missing, or the account is inactive. `SECURITY DEFINER` lets it read `public.users` from inside that table's own policies without RLS recursion (see "RLS recursion" below). Reused by nearly every other policy. |
| `current_user_partner_id()` | The caller's `partner_id`, or `null` for internal roles, for any inactive/missing-profile `partner_user`, (since VI-F03-S07) for a `partner_user` whose partner is not `active`, and (since VI-F03-S08) for any user whose role is not `partner_user`. A `null` result makes a `partner_id = current_user_partner_id()` clause return zero rows rather than error or "all rows," turning the partner-isolation design principle above into a database fact. |
| `is_internal_user()` | True for `admin`/`operations_manager`/`technician` — the three internal, non-partner roles. |
| `is_admin_or_ops_manager()` | True for `admin`/`operations_manager` — the single most repeated gate in the migration (write access on `partners`/`airports`/`seat_categories`/`seats`/`flights`/`bookings`/`technician_jobs`, and broad SELECT-all on most other tables). |
| `booking_partner_id(uuid)` | Not part of the ticket's original 4-function list. Returns a booking's `partner_id`, bypassing `bookings`' own RLS. Exists solely to break a real RLS recursion cycle discovered while testing this migration (see "RLS recursion" below) — `bookings`' technician-visibility policy queries `technician_jobs`, and without this function `technician_jobs`' `partner_user`-visibility policy would query `bookings` back, which Postgres detects as infinite policy recursion (`42P17`). |

**RLS recursion**: two tables whose policies query each other cause
Postgres to error with `42P17 infinite recursion detected in policy`,
because evaluating either table's policy re-triggers evaluating the
other's. `public.users` avoids this by construction — its own
`SECURITY DEFINER` helper functions read it as the (RLS-bypassing) table
owner. `bookings` and `technician_jobs` needed the same treatment
(`booking_partner_id()`) because their policies reference each other
directly. Any future policy that joins two RLS-enabled tables should be
checked for this before shipping — it is not caught by `db reset` syntax
validation, only by actually querying the affected tables (which is how
this instance was found).

**Privilege-escalation trigger**: `prevent_users_privilege_escalation()`
(`BEFORE UPDATE ON public.users FOR EACH ROW`) blocks any non-admin
caller from changing `role`, `partner_id`, or `is_active` on any row it
is otherwise allowed to `UPDATE` (e.g. its own row, via the self-update
policy below). RLS `USING`/`WITH CHECK` clauses can only decide *which
rows* a statement touches, not diff old-vs-new column values within an
`UPDATE` — this is a column-level guard that RLS alone cannot express.

**Per-table access rules**:

| table | SELECT | INSERT / UPDATE | notes |
|---|---|---|---|
| `users` | admin: all. operations_manager: all (read-only). technician/partner_user: own row only | INSERT: `id = auth.uid()` only. UPDATE: admin (all), or own row (`id = auth.uid()`, guarded by the trigger above) | No coworker visibility for `partner_user` (deliberately narrow) |
| `partners` | admin/operations_manager: all. partner_user: own partner | admin/operations_manager only | |
| `airports`, `seat_categories`, `flights` | any `authenticated` user (`USING (true)`) | admin/operations_manager only | Shared reference data, no partner/financial/personal fields — see the caution in `docs/database.md` about adding sensitive columns later |
| `seats` | admin/operations_manager: all. technician: seat on a booking assigned to them. partner_user: seat on a booking of their partner | admin/operations_manager only | Technician status/rental_cycles writes are deferred to F16-F18 |
| `seat_status_history` | admin/operations_manager only | admin/operations_manager only (INSERT scaffolding, no writer yet) | Append-only log |
| `bookings` | admin/operations_manager: all. technician: assigned to them (via `assigned_technician_id` or `technician_jobs`). partner_user: own partner | admin/operations_manager only | Cancellation is an UPDATE (`status = 'cancelled'`), already covered |
| `booking_events` | same shape as `bookings` (joins through `booking_id`) | admin/operations_manager, plus technician limited to bookings assigned to them | Append-only log |
| `technician_jobs` | admin/operations_manager: all. technician: own jobs. partner_user: jobs on their partner's bookings (via `booking_partner_id()`) | INSERT: admin/operations_manager. UPDATE: admin/operations_manager, or technician limited to their own row (`technician_id = auth.uid()`) | Technician UPDATE stops reassigning `technician_id` to someone else. `booking_id` is immutable and status columns change only through `change_technician_job_status()` (FO-F01-S05 guard trigger) |
| `installations` | admin/operations_manager: all. technician: own job. partner_user: their partner's bookings (two-hop join) | technician (own job) + admin/operations_manager | Append-only log |
| `cleaning_records` | admin/operations_manager: all. technician: `employee_id = auth.uid()`. partner_user: their partner's bookings (`booking_id` non-null only) | technician (`employee_id = auth.uid()`) + admin/operations_manager | Append-only log; a `booking_id is null` row is invisible to every `partner_user` |
| `inspection_records` | same shape as `cleaning_records`, `inspector_id` instead of `employee_id` | same shape | Append-only log |
| `incidents` | admin/operations_manager: all. technician: `reported_by = auth.uid()`. partner_user: own partner | technician (`reported_by = auth.uid()`) + admin/operations_manager, both requiring `partner_id` to match the referenced booking's real `partner_id` when `booking_id` is supplied. UPDATE: admin only | `operations_manager` has no resolve/manage permission in F04's permission table, so this is not a new restriction RLS introduces |
| `partner_commercial_terms`, `settlements`, `invoices` | admin/operations_manager: all. partner_user: own partner | admin only | F04 has no `finance:manage` permission for any non-admin role |
| `ai_queries` | own rows, or admin | own rows, or admin | No `ai:*` permission exists in F04 yet (F28 not started) — the most conservative shape in the migration; INSERT is scaffolding, no writer exists yet |

**Technician-restriction pattern**: every technician-visibility policy is
scoped to rows the technician is the direct actor on or assigned to —
`employee_id`/`inspector_id`/`reported_by`/`technician_id` `= auth.uid()`,
or a join through `technician_jobs`/`bookings` to a row where they are
the assigned technician. No technician policy ever grants broader
visibility (e.g. "all seats at their airport") — those are explicitly
deferred to whichever future feature (F09/F14/F15) defines a concrete
need, not assumed here.

**No DELETE policy** exists on any table for any role. This is a single
uniform decision, not 18 separate oversights — consistent with
`docs/database.md`'s "no `ON DELETE CASCADE`... partners/seats/bookings
are deactivated via `status`, never hard-deleted" convention. The absence
of a matching policy means RLS denies every `DELETE` by default.

**Anonymous access is denied by default everywhere.** No policy in this
migration targets `anon`, including the `USING (true)` policies on
`airports`/`seat_categories`/`flights` — those are explicitly scoped `to
authenticated`. An unauthenticated request returns zero rows (not an
error) on all 18 tables.

**Service-role**: unchanged. No service-role/secret-key client exists in
this codebase, and this migration does not introduce one — see "Secrets"
below.

**Design notes (documentation-only, not implemented by F05)**:

- **Seat QR code (`F10`)**: a QR scan only identifies the seat (PO
  Decision Log, PRD v1.1 section 20). There is no public lookup, so
  `seats`' RLS stays scoped `to authenticated` only: never add an `anon`
  policy to `seats`, and never a public view or `SECURITY DEFINER` RPC that
  returns seat data by `public_token`. RLS works at row granularity, not
  column granularity, so a public policy could not hide internal columns
  anyway. See "Seat QR code" below for the rules.
- **Storage**: no bucket exists yet. When a real upload feature needs one
  (inspection/cleaning photos in F16-F18, invoice PDFs in F25), its
  bucket/path convention should mirror this same `partner_id`/role
  ownership model via `storage.objects` policies, reusing the helper
  functions above rather than reimplementing the same checks.

### F06 — Partner Management

The `/partners*` routes (`src/app/(admin)/partners/**`) are an
application-layer CRUD module sitting entirely on top of F05's existing
`partners_*` RLS policies (see the per-table rules above) — **F06
introduced no new migration and no new/changed RLS policy**. The F05
coverage already matched F06's exact access model: admin/
operations_manager full SELECT/INSERT/UPDATE, `partner_user`
SELECT-own-row-only, `technician` zero rows (no policy grants it access),
no DELETE policy for any role. This was verified both by re-reading the
migration and by a live integration-test addition (`partners table`
describe block in `src/lib/auth/rls.integration.test.ts`) exercising all
of the above against a real local Postgres instance.

**Route-level gate**: `requirePermission("partners:manage")` runs in both
`src/app/(admin)/partners/layout.tsx` and independently in every
`page.tsx` under it (list/new/detail/edit), plus again at the top of
every partners Server Action (`create-partner.action.ts`,
`update-partner.action.ts`, `deactivate-partner.action.ts`) — never
skipped on the assumption that "RLS already covers admin/
operations_manager." RLS is the last line of defense, not a substitute
for the route/action guard: it cannot produce a friendly `/forbidden`
redirect or stop a page from attempting a query in the first place.

**Deactivation is DB-`status`-only**, consistent with
`docs/database.md`'s "no `ON DELETE CASCADE`... deactivated via `status`,
never hard-deleted" convention: `deactivate-partner.action.ts` only ever
sets `status = 'inactive'` for one partner id and rejects an
already-inactive target with a `CONFLICT` error rather than silently
no-oping. No DELETE is ever issued against `partners` from application
code, matching the "no DELETE policy exists" fact above.

### F07 — Airport Management

The `/airports*` routes (`src/app/(admin)/airports/**`) are an
application-layer CRUD module sitting entirely on top of F05's existing
`airports_*` RLS policies (see the per-table rules above) — **F07
introduced no new migration and no new/changed RLS policy**. F05's
coverage already matched F07's access model: admin/operations_manager
full SELECT/INSERT/UPDATE, every other `authenticated` role
SELECT-only (`using (true)` — `airports` is shared reference data), no
DELETE policy for any role. Re-verified by re-reading the migration
before implementation, per the same precedent as F06.

Note that this route-level gate is **narrower** than what RLS alone
would allow: RLS lets any `authenticated` user (including `technician`,
`partner_user`) `SELECT` the `airports` table directly, but
`requirePermission("airports:manage")` restricts the entire `/airports*`
UI to admin/operations_manager — a `technician` is redirected to
`/forbidden` even though the DB would technically permit a read. This is
intentional: "RLS is the last line of defense, not a substitute for the
route/action guard" applies in both directions — a route guard is
allowed to be stricter than the RLS floor, not just as permissive as it.

**Route-level gate**: `requirePermission("airports:manage")` runs in
both `src/app/(admin)/airports/layout.tsx` and independently in every
`page.tsx` under it (list/new/detail/edit), plus again at the top of
every airports Server Action (`create-airport.action.ts`,
`update-airport.action.ts`).

**No delete/deactivate**: F07 has no status column and no
delete/deactivate action in scope — no DELETE is ever issued against
`airports` from application code, matching the "no DELETE policy exists"
fact above; there is also no soft-delete convention here (unlike
`partners`' `status = 'inactive'` pattern), since nothing irreversible
exists in this feature.

### F08 — Seat Category Management

The `/seat-categories*` routes (`src/app/(admin)/seat-categories/**`) sit
on top of F05's existing `seat_categories_*` RLS policies —
**F08 introduced no new migration and no new/changed RLS policy**
(SELECT for any `authenticated` user, INSERT/UPDATE for
admin/operations_manager, no DELETE policy). As with `/airports*`, the
route gate is stricter than the RLS floor.

**Permission**: `seat_categories:manage` (admin via short-circuit,
`operations_manager` explicitly; `technician`/`partner_user` never). It
runs in `layout.tsx`, independently in every `page.tsx`, and at the top of
every Server Action (create, update, set-active).

**No delete**: deactivation is `is_active = false` only; no DELETE is
ever issued (`seats.category_id` and `bookings.seat_category_id` are
`ON DELETE RESTRICT`). `name` has no unique constraint, so duplicate names
are checked case-insensitively in the Server Actions (best effort; can
race under concurrent writes).

### F09 — Seat Inventory Management

The `/seats*` routes (`src/app/(admin)/seats/**`) are gated by the
existing `seats:manage` permission (admin via short-circuit,
`operations_manager` explicitly; `technician`/`partner_user` never). It
runs in `layout.tsx`, independently in every `page.tsx`, and at the top of
every Server Action (create, update, change status). No RBAC change.

**One new migration, no policy change**
(`20260930090000_seat_status_history_trigger_and_change_seat_status.sql`).
No existing policy was changed, no UPDATE/DELETE policy was added to
`seat_status_history` (still append-only), and no service-role client is
used.

- **`public.record_seat_status_change()` trigger function** (`SECURITY
  DEFINER`, `set search_path = ''`, fully schema-qualified, returns
  `trigger` so it is not callable over RPC; execute revoked from `public`
  and `anon`). Fired `AFTER INSERT` and `AFTER UPDATE OF status` (only
  when the value actually changes) on `public.seats`. It writes the
  `seat_status_history` row (`from_status` null on insert,
  `changed_by = auth.uid()` resolved through `public.users` so a missing
  profile gives NULL instead of an FK failure, `reason` from the
  transaction-local setting `app.seat_status_reason`). Reason for
  `SECURITY DEFINER`: the history write must not depend on the caller
  holding a history INSERT policy, so no status change can ever skip its
  audit row. The `seats` write itself is still authorized by seats RLS.
- **`public.guard_seat_update()` trigger function** (`BEFORE UPDATE`
  on `public.seats`, `SECURITY INVOKER` since it reads no tables, `set
  search_path = ''`, returns `trigger` so it is not callable over RPC;
  execute revoked from `public`/`anon`). RLS cannot restrict columns, so
  this closes the gap where a `seats:manage` user could PATCH `status`
  directly and skip the transition rules. It rejects (SQLSTATE `55000`):
  any change to `serial_number` or `public_token`; any status change away
  from `retired`; any status change, and any change to `retired_at` or
  `quarantine_reason`, made outside `change_seat_status()`. The RPC marks
  its transaction with `set_config('app.seat_status_change', 'on', true)`
  (separate from the reason setting `app.seat_status_reason`); an unset or
  blank value means reject. This relies on PostgREST not exposing
  `set_config`; callers cannot run arbitrary SQL through the API. INSERT
  and updates of other columns are unaffected.
- **`public.change_seat_status(p_seat_id, p_to_status, p_reason)`**
  (`SECURITY INVOKER`, so seats RLS applies; `set search_path = ''`;
  execute revoked from `public`/`anon`, granted to `authenticated`). Locks
  the row `FOR UPDATE` and allows only: `available -> quarantine`
  (reason required, sets `quarantine_reason`), `quarantine -> available`
  (clears `quarantine_reason`), `available | quarantine -> retired` (sets
  `retired_at`, terminal). Error codes: `P0002` not found (also what a
  caller RLS hides the seat from receives), `55000` invalid transition,
  `22023` missing reason. Operational statuses (`reserved`, `in_use`,
  `cleaning`, `inspection`) are not manually reachable; later workflows
  own them and the trigger still records their history.

**Input rules enforced in the Server Actions**: `public_token` is never
user-supplied (DB default), `status`/`rental_cycles` are not accepted by
the create/update schemas, `serial_number` is immutable after create,
retired seats cannot be edited, an inactive `category_id` is rejected on
create (on update only the seat's current category is accepted), and a
duplicate serial is caught by a
pre-check plus the UNIQUE constraint (`23505` -> `DUPLICATE_SERIAL`).
**No delete**: `seats` has no DELETE policy and no delete action exists.

### F11 — Booking Management

The `/bookings*` routes live under `src/app/(dashboard)/bookings/**`
(the `(dashboard)` layout already provides `AppShell`). The list and
detail routes are gated by `requireAnyPermission(["bookings:manage",
"bookings:view_own_partner"])` in `layout.tsx` and again in each page;
`technician` is forbidden. The Server Actions for changing the status and
for the available seats require `bookings:manage` (admin and
`operations_manager`). `/bookings/new` and `/bookings/[id]/edit` take
`bookings:manage` or, since VI-F03-S03, `bookings:manage_own_partner` (see
"Partner creates and edits bookings"). A `partner_user` still has no
INSERT/UPDATE policy on `bookings` and cannot change a status. The any-of
helper `requireAnyPermission()` (`src/lib/auth/current-user.ts`) and any-of
nav items (`src/config/nav.ts`) are small additions to F04.

**Two new migrations** (`20261002070734_booking_numbering_event_log_and_guards.sql`,
`20261002070738_booking_rpcs.sql`). No service-role client is used.

- **DROPPED policies**: `booking_events_insert_admin_ops_manager` and
  `booking_events_insert_technician`. Reason: the audit log must only be
  written by the server. Before this, any admin/ops/assigned technician
  could INSERT arbitrary events over PostgREST. `booking_events` is now
  written only by the `SECURITY DEFINER` trigger function
  `record_booking_event()` (`set search_path = ''`, returns `trigger`, so
  it is not callable over RPC; execute revoked from `public`/`anon`).
  Consequence for later work (F15 technician workflow): events must be
  written through an RPC or trigger, not a direct INSERT. The SELECT
  policies are unchanged.
- **Append-only**: `prevent_booking_event_mutation()` (`BEFORE UPDATE`
  and `BEFORE DELETE` on `booking_events`) rejects every UPDATE and DELETE
  for every role, including `service_role` (SQLSTATE `55000`). One
  exception: a nested trigger (`pg_trigger_depth() > 1`) that only nulls
  `seat_id`/`user_id`, i.e. the existing `ON DELETE SET NULL` FK actions,
  so deleting a seat or user is not blocked. A direct client UPDATE runs at
  depth 1 and is still rejected.
- **Guard trigger** `guard_booking_update()` (`BEFORE UPDATE` on
  `bookings`, `SECURITY INVOKER`, returns `trigger`). RLS cannot restrict
  columns, so without it admin/ops could PATCH the protected columns
  directly. It rejects (`55000`) changes to `status`, `assigned_seat_id`,
  `partner_id`, `booking_number`, `airport_id`, `seat_category_id`,
  `pickup_at`, `return_at`, `daily_rate`, `paid_days`, `gross_revenue`,
  `partner_share` and `platform_share` unless the transaction set
  `app.booking_change = 'on'` (done only inside the booking RPCs; relies on
  PostgREST not exposing `set_config`). Not protected: `assigned_technician_id`,
  `flight_id`, `incident_status`, arrival timestamps, `external_booking_number`,
  `child_*`, `vehicle*`, `notes`. Future finance code (F22) must set the
  same signal from its own function. The `ON DELETE SET NULL` of
  `assigned_seat_id` (nested trigger) is allowed.
- **Insert guard** `guard_booking_insert()` (`BEFORE INSERT` on
  `bookings`): client roles can insert only inside `create_booking()`
  (signal `app.booking_change`); a direct INSERT fails with `55000`. The
  INSERT policy `bookings_insert_admin_ops_manager` is unchanged. Owner
  roles (`postgres`, `supabase_admin`) are exempt so the seed and
  migrations work; PostgREST never uses them. A future `SECURITY DEFINER`
  function owned by `postgres` that inserts into `bookings` also skips
  this guard, so it must set the signal and enforce its own rules.
- **Nested-trigger exemption** (the `ON DELETE SET NULL` carve-outs in the
  guard and the append-only trigger) relies on there being **no DELETE
  policy on `seats` (or `users`) for client roles**. If one is ever added,
  re-check this: a client could otherwise unassign a seat by deleting it.
  `TRUNCATE` on `booking_events` is also rejected by trigger.
- **Terminal/stale rules apply to the RPC path only**: the unguarded
  columns (`notes`, `vehicle`, `vehicle_bay`, `child_*`,
  `external_booking_number`) can still be PATCHed directly by admin/ops on
  a terminal booking, and without `expected_updated_at`. This is accepted;
  the change is still logged as an `updated` event. An integration test
  pins the behaviour.
- **Finance columns** (`paid_days`, `gross_revenue`, `partner_share`,
  `platform_share`) are not selected by the booking queries, so the UI
  never receives them; RLS cannot hide columns, so a partner calling
  PostgREST directly can still read them on its own bookings.
- **RPCs** (all `SECURITY INVOKER`, `set search_path = ''`, execute
  revoked from `public`/`anon`, granted to `authenticated`; each starts
  with an explicit admin/ops check using `coalesce(is_admin_or_ops_manager(), false)`
  because the helper returns NULL for inactive callers): `create_booking`,
  `update_booking`, `change_booking_status`, `get_available_seats`, plus
  the helper `assert_booking_seat_assignable` and `generate_booking_number`
  (`SECURITY DEFINER`, only reads the sequence; a caller can at most burn a
  number).
- **State matrix** (before F11 there was none: `bookings.status` was a plain
  column admin/ops could set freely): `pending -> confirmed | cancelled`,
  `confirmed -> cancelled | no_show`. `pending -> no_show` is not allowed.
  `assigned`, `in_progress` and `completed` belong to later workflows;
  `cancelled`, `no_show`, `completed` are terminal. A reason is required for
  `cancelled` and `no_show` and is stored as the event notes. Only `pending`
  and `confirmed` bookings can be edited.
- **Seat rules**: seat `status = 'available'`, same `airport_id` and
  `category_id` as the booking, and no overlapping active booking
  (`pending`, `confirmed`, `assigned`, `in_progress`; touching endpoints are
  not a conflict). The seat row is locked `FOR UPDATE` so two concurrent
  assignments of one seat are serialized. Assigning a seat does not change
  `seats.status`. There is no per-partner seat ownership in the schema
  (`seats` has no `partner_id`), so "restricted inventory" is limited to
  the existing seats RLS plus assigning seats only through the RPCs.
  Error messages never name another partner's booking.
- **Error codes**: `42501` not admin/ops, `P0002` not found, `22023`
  invalid input (including null pickup/return) or missing reason, `55000` invalid state/transition or
  guard violation, `BK001` seat not available, `BK002` seat time conflict,
  `BK003` seat category/airport mismatch, `BK004` stale
  `expected_updated_at`, `BK005` seat not found. Mapped to the action error codes `FORBIDDEN`,
  `NOT_FOUND`, `VALIDATION_ERROR`, `INVALID_TRANSITION`, `SEAT_UNAVAILABLE`,
  `SEAT_CONFLICT`, `SEAT_CATEGORY_MISMATCH`, `SEAT_NOT_FOUND`, `STALE_DATA`.
- **Breaking**: direct INSERT into `booking_events` and direct PATCH of the
  guarded `bookings` columns now fail. Nothing in `src/` did either.

**Input rules enforced in the Server Actions**: `status`, `booking_number`,
finance, flight and technician fields are not accepted by the schemas;
`daily_rate` is entered at create and read-only afterwards; partner,
airport and category are read-only on edit; times are typed as wall-clock
time at the airport and converted to UTC with `airports.timezone`.
**No delete**: `bookings` has no DELETE policy and no delete action exists.

## Secrets

- `SUPABASE_SERVICE_ROLE_KEY` / the newer secret key (`sb_secret_...`)
  must never be shipped to client-side code, imported into a Client
  Component, or exposed via a `NEXT_PUBLIC_` prefixed variable.
- No service-role/secret-key client exists in the codebase yet. One is
  introduced only when a specific feature has a concrete, reviewed need to
  bypass RLS from trusted server code.
- The publishable key (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) is safe to
  expose — it carries the same low privilege as the legacy anon key, and
  access is enforced by RLS, not by keeping the key secret.

## Configuration check (CP-F01-S05)

- `src/lib/config/env.ts` validates the required environment variables
  with Zod (`getPublicEnv()`): `NEXT_PUBLIC_SUPABASE_URL` must be a valid
  URL and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` must be non-empty.
- `src/instrumentation.ts` calls it when the server starts, so a missing
  or invalid variable fails at startup with a `ConfigurationError`. The
  Supabase clients and the session proxy use the same function instead of
  `process.env.X!`.
- The error message lists variable names only — never their values.
- `NEXT_PUBLIC_*` variables are bundled into the browser. Never put a
  secret or the service-role key behind that prefix; a test fails if a
  `NEXT_PUBLIC_*SECRET*` or `NEXT_PUBLIC_*SERVICE_ROLE*` name appears in
  `src`.
- Before this change `src/proxy.ts` silently skipped session refresh when
  the variables were unset. That fallback was removed on purpose.

## Sign-in failure handling (CP-F03-S08)

- `src/features/auth/lib/login-errors.ts` maps Supabase Auth errors to
  user-facing sign-in messages: network failure (`AuthRetryableFetchError`),
  rate limit (`over_request_rate_limit` / HTTP 429), unconfirmed email,
  and a single generic "Invalid email or password." that never
  distinguishes a wrong password from an unknown account.
- Rate limiting is enforced by Supabase Auth (`[auth.rate_limit]` in
  `supabase/config.toml`). The app does not add its own lockout; it only
  reports the limit. A custom policy is still to be determined.
- `loginAction` returns a generic message instead of throwing on
  unexpected errors. The client wrapper `submitLogin` turns a failed
  Server Action call (for example the browser being offline) into a
  retryable message and re-throws Next.js redirect errors so a
  successful sign-in still navigates.

## Seat access scope (CO-F04-S09)

- Scope is enforced by `seats` RLS, not by the app: `technician` reads
  only seats on bookings with one of their own jobs, and `partner_user`
  reads only seats on their own partner's bookings. A `partner_user`
  with no `partner_id` reads nothing. `seat_status_history` is
  admin/operations only.
- The policies do not look at booking or job status, so a seat on a
  cancelled booking or a finished job stays readable by that partner or
  technician. The spec does not define a cutoff yet.
- `/seats*` is guarded by `seats:manage`, so `technician` and
  `partner_user` are sent to `/forbidden`. `seats:view_own_partner`
  exists in the permission model but no route uses it yet; a read-only
  seat view for these roles is not built.
- Covered by the "seat access scope (CO-F04-S09)" integration tests in
  `src/lib/auth/rls.integration.test.ts` (read by id and by list, allowed
  and cross-partner/cross-job denied).

## Technician list (FO-F01-S01)

- `/technicians` and `/technicians/[id]` are guarded by
  `technicians:manage` (admin and operations_manager) in the layout and
  on every page. Other roles are sent to `/forbidden`.
- A technician is a `public.users` row with `role = 'technician'`; there
  is no separate technicians table. Access is enforced by the existing
  `users` RLS (`users_select_admin_ops_manager`, `users_select_self`),
  so a `technician` lists only themselves and a `partner_user` lists
  none. Covered by the "technician list access (FO-F01-S01)" tests in
  `src/lib/auth/rls.integration.test.ts`.
- Only `id, full_name, email, is_active, created_at` are selected.
- The search value is optional, trimmed and limited to 100 characters.
  The client form and the server page use the same Zod schema; an
  over-long value shows an error and is not applied. The value is
  escaped for `ilike` and quoted for PostgREST before it reaches `.or()`.
- The per-technician job list is not built yet (Job List, FO-F01-S02).

## Job list (FO-F01-S02)

- `/jobs` is guarded by `technicians:manage` or `jobs:view_assigned`
  (`JOBS_ACCESS_PERMISSIONS`) in the layout and on the page.
  `partner_user` is sent to `/forbidden`.
- Rows are scoped by the existing `technician_jobs` RLS: admin and
  operations_manager read every job, a `technician` reads only their own.
  The page hides the technician filter from technicians and ignores a
  `technician_id` in the URL for them; RLS would return nothing for
  another technician's id anyway.
- One nested select returns the job with its booking number and
  technician name (no per-row lookups). Search matches the booking
  number through the embedded booking, is optional, trimmed, limited to
  100 characters on the client and the server, and escaped for `ilike`.
- Covered by the "job list access (FO-F01-S02)" tests in
  `src/lib/auth/rls.integration.test.ts`.
- Rows do not link anywhere yet: Job detail (FO-F01-S03) and job
  creation (FO-F01-S04) are separate stories.

## Job detail (FO-F01-S03)

- `/jobs/[id]` uses the same any-of guard as `/jobs`
  (`technicians:manage` or `jobs:view_assigned`). A job outside the
  caller's RLS scope (another technician's) or a malformed id returns
  `null` and renders `notFound()`, so it looks the same as a missing id.
- The query selects an explicit column list: job status and timestamps,
  vehicle bay, installation notes, and from the booking only the booking
  number, pickup and return time, vehicle, child age band and height,
  airport code and name, and the assigned seat serial and category. It
  never selects `daily_rate`, `paid_days`, `gross_revenue`,
  `partner_share`, `platform_share`, `partner_id`,
  `external_booking_number` or booking `notes`.
- Known gap: RLS limits rows, not columns. A technician already has
  SELECT on their own bookings' full rows, so calling the API directly
  could still read the pricing columns. Closing that needs a view or RPC
  with a column allowlist; it is not part of this story.
- Read-only apart from the status control added in FO-F01-S05 (see below).

## Create and assign job (FO-F01-S04)

- Route `/jobs/new` and `createJobAction` both require `technicians:manage`
  (admin, operations_manager). The `/jobs` layout also admits technicians,
  so the page and the action each add their own guard; hiding the
  "Create job" link is not an access check.
- Input is validated with Zod (`create-job.schema.ts`) on the client and the
  server. The action inserts only `job_type`, `technician_id` and
  `booking_id`; `status` and timestamps come from column defaults.
- RLS is unchanged: `technician_jobs_insert_admin_ops_manager` is the
  boundary. A technician or partner_user insert is denied.
- Values RLS cannot judge are checked by the `guard_technician_jobs_insert`
  trigger (`SECURITY DEFINER`): `JB001` when the assignee is not an active
  technician (E2, blocked rather than flagged), `JB002` when the booking is
  not pending/confirmed/assigned/in_progress. A partial unique index on
  `(booking_id, job_type)` for open jobs rejects a duplicate (`23505`).
- Errors are mapped to a stable code (`TECHNICIAN_INACTIVE`,
  `BOOKING_NOT_ACTIVE`, `DUPLICATE_JOB`, ...); raw database errors are not
  returned.
- Creating a job does not change the booking (no `assigned_technician_id` or
  status update).
- Covered by the "job create access (FO-F01-S04)" tests in
  `src/lib/auth/rls.integration.test.ts`.

## Update job status (FO-F01-S05)

- The status control on `/jobs/[id]` and `changeJobStatusAction` require
  `jobs:update_assigned` (technician) or `technicians:manage` (admin, ops).
  The page hides the control when the user has no permitted transition; the
  database function is the enforcing authority.
- Status changes go only through `change_technician_job_status()`
  (SECURITY INVOKER, row lock). `technician_jobs` RLS still applies, so a
  technician cannot see or change another technician's job (reported as
  not found, `P0002`).
- Transitions: `assigned` -> `in_progress` (sets `started_at`),
  `in_progress` -> `completed` (sets `completed_at`), `assigned` or
  `in_progress` -> `cancelled` (admin/ops only, reason required).
  `completed` and `cancelled` are terminal. An invalid change is `55000`;
  cancelling without being admin/ops is `42501` (forbidden, since FO-F01-S08);
  a job that changed since it was loaded is `JB004`.
- `guard_technician_jobs_update` closes the column gap of
  `technician_jobs_update_technician`: `status`, `started_at` and
  `completed_at` cannot be PATCHed directly, `booking_id` is immutable, and
  `technician_id` can only be changed by admin/ops to an active technician
  (`JB001`). Other columns (e.g. `installation_notes`) stay editable by the
  assigned technician.
- `technician_job_events` is the audit log (status and assignee changes). It
  has RLS enabled in the migration that creates it: admin/ops read all, a
  technician reads events of their own jobs, partner users have no access.
  There is no INSERT/UPDATE/DELETE policy; rows are written by the
  `record_technician_job_event()` SECURITY DEFINER trigger and
  `prevent_technician_job_event_mutation()` blocks UPDATE, DELETE and
  TRUNCATE (except the FK `set null` action when a user is deleted).
- Covered by the "job status update (FO-F01-S05)" tests in
  `src/lib/auth/rls.integration.test.ts`, including cross-technician and
  partner_user denial on the events table.
- Creating a job does not write an event; the first event is the first
  change. Booking status is not changed by a job status change.

## Open work record (FO-F01-S06)

- `/jobs/[id]` shows a "Record work" link to the workflow screen that
  matches the job type (`/jobs/[id]/installation`, `/cleaning`,
  `/inspection`). `getWorkRecordHref()` offers it only when the workflow
  screen is available, the job is `assigned` or `in_progress`, the job is
  assigned to the signed-in user, and the user holds the matching permission
  (`installation:perform`, `cleaning:create`, `inspections:create`).
- Hiding the link is not an access check. Each workflow screen (FO-F02 to
  FO-F04) must guard itself with its own permission and rely on RLS for the
  job scope.
- Every workflow is `available: false` in `WORK_RECORD_WORKFLOWS` until its
  screen exists; the story that ships a screen flips its flag.
- No database change, no new input: the href is built from constants and the
  validated job id.

## Handle unassignment (FO-F01-S07)

- When a technician is unassigned while a job is open, RLS removes the job
  at once: it leaves their list and detail, their status change is rejected
  (`P0002`) and a direct edit changes zero rows. The job history is hidden
  from them too (`technician_job_events_select_technician` follows the
  current assignee).
- The UI says the same thing for "does not exist" and "no longer assigned
  to you" (`NOT_FOUND`): RLS cannot tell them apart and the message must not
  reveal that a job exists. The status dialog then points to the job list
  and hides Confirm; `/jobs/[id]` shows a job-specific not-found page.
- No push or polling: the list updates on the next request. There is no
  notification to the technician.
- Covered by the "job unassignment (FO-F01-S07)" tests in
  `src/lib/auth/rls.integration.test.ts`. No migration or policy change.

## Job errors (FO-F01-S08)

- **Conflict**: a status change carries the status the user saw
  (`p_from_status`). When another user changed the job first the database
  returns `JB004` (`STALE_DATA`) and nothing is overwritten. The UI refreshes
  the job, keeps the dialog open and re-syncs the form to the status now
  shown, so the user can review and retry. Creating a duplicate open job is
  `23505` (`DUPLICATE_JOB`).
- **Network failure**: `runJobAction()` turns a failed Server Action call
  into a `NETWORK_ERROR` result instead of an error-boundary page, so the
  dialog or form stays open with the user's input. Next redirect and
  not-found signals are re-thrown. There is no automatic retry.
- **Revoked permission or assignment**: page and action guards still
  redirect to `/forbidden`. Inside a screen that is already open, the job
  RPC rejects with `42501` (`FORBIDDEN`: e.g. a manager whose role was
  revoked trying to cancel) or `P0002` (`NOT_FOUND`: unassigned, see
  FO-F01-S07). The alert shows a forbidden or unavailable state and hides
  Confirm.
- Messages never include database details or other users' names.
- Covered by the conflict and forbidden tests in
  `src/lib/auth/rls.integration.test.ts` and the unit tests of
  `run-job-action.ts`, `job-errors.ts` and `job-status-error-alert.tsx`.

## Record installation (FO-F02-S01)

- `/jobs/[id]/installation` and `recordInstallationAction` require
  `installation:perform` (technician) or `technicians:manage` (admin, ops).
  The "Record work" link is offered only to the assigned technician; hiding
  it is not an access check.
- RLS is unchanged: the assigned technician or admin/ops may insert; a
  technician cannot record on another technician's job, a partner user
  cannot insert at all. There is no UPDATE or DELETE policy, so a recorded
  installation is an immutable log row.
- The guard trigger `guard_installations_insert` (SECURITY DEFINER) checks
  values RLS cannot: job type and status, the seat of the booking and its
  status, and the time not being in the future. It overwrites `seat_id` and
  `created_by`, so the client cannot forge them. A direct insert through
  PostgREST goes through the same trigger.
- The Server Action takes the airport timezone and the seat from the
  database (the time is wall-clock at the airport, the submitted seat must be
  the booking's seat) and inserts only `technician_job_id`, `completed_at`,
  `notes` and `installation_completed`.
- One installation per job (unique index); there is no edit or correction
  path. Recording does not change the seat or the job status.
- Covered by the "record installation (FO-F02-S01)" tests in
  `src/lib/auth/rls.integration.test.ts`.

## Installation history (FO-F02-S03)

- A recorded installation is kept unchanged at two layers: no UPDATE or
  DELETE policy, and `UPDATE`, `DELETE` and `TRUNCATE` are revoked from
  `anon` and `authenticated` (migration
  `20261019090000_installations_revoke_mutation.sql`). Supabase grants them
  by default and `TRUNCATE` is not covered by RLS. A change attempt now
  fails with `42501` instead of matching zero rows. `service_role` and the
  table owner are unaffected, so only trusted server code or a migration can
  change the log.
- Two recordings for one job: the unique index lets one through and rejects
  the other with `23505` (`ALREADY_RECORDED`). First save wins; the second is
  rejected, never merged (the log is immutable).
- Covered by the "record installation (FO-F02-S01)" tests (concurrent
  insert, first record kept, update and delete denied for every role).

## Record cleaning (FO-F03-S01)

- `/jobs/[id]/cleaning`, `startCleaningAction` and `completeCleaningAction`
  require `cleaning:create` (technician) or `technicians:manage` (admin, ops).
  Since FO-F03-S04 the cleaning is two steps through database functions (see
  "Cleaning and availability"); the one-step insert described below was
  replaced. The "Record work" link is
  offered only to the assigned technician; hiding it is not an access check.
- RLS changed: `cleaning_records_insert_technician` now also requires the
  record's `technician_job_id` to be a job assigned to the caller. Before, a
  technician could insert a cleaning for any seat (`employee_id = auth.uid()`
  was the only check). Admin/ops keep their policy. A partner user cannot
  insert. There is still no UPDATE or DELETE policy, so a recorded cleaning is
  an immutable log row.
- The guard trigger `guard_cleaning_records_insert` (SECURITY DEFINER) checks
  values RLS cannot: job type and status, the booking's seat and its status
  (only `retired` is rejected, the status model defines no other rule for
  cleaning yet), and the time. It overwrites `seat_id`, `booking_id`,
  `employee_id` and `started_at`, so the client cannot forge them. It runs
  only when a job is given; a row without a job can only come from admin/ops
  or a trusted server insert, never from a technician.
- `employee_id` is the user who recorded it (`auth.uid()`), like
  `installations.created_by`. Recording does not change the seat or the job
  status.
- One cleaning per job (unique index). The error behavior (conflict, network
  failure, lost assignment) is the same as for installations.
- Covered by the "record cleaning (FO-F03-S01)" tests in
  `src/lib/auth/rls.integration.test.ts`. The retired-seat and no-seat
  branches of the trigger are not covered there: a booking's seat can only be
  changed through the booking functions and a retired seat cannot be restored.

## Cleaning assignment (FO-F03-S02)

- Only the assigned technician or an internal role (admin, operations
  manager) can record a cleaning. The boundary is the database:
  `cleaning_records_insert_technician` requires the job to be assigned to the
  caller, admin/ops use their own policy, and a partner user has no insert
  policy. The screen and the Server Action add the permission check
  (`CLEANING_RECORD_PERMISSIONS`) and the forbidden state, but hiding the link
  or the form is not the access check.
- A technician who is not assigned gets the forbidden state on
  `/jobs/[id]/cleaning` (RLS hides the job, the page cannot tell it from a
  missing one) and `NOT_FOUND` from the action. If the assignment is lost
  while the form is open, the next save is rejected by RLS and the form shows
  "no longer available" with a link to the jobs.
- An internal user records as themselves: `employee_id` is the user who
  recorded it, not the technician of the job.
- No code changed for this story; it adds the tests that prove the boundary:
  lost assignment (RLS), internal role records as themselves (action), the
  permission group (who can open the screen) and the form for an internal
  user (page).

## Cleaning history (FO-F03-S03)

- A recorded cleaning is kept unchanged at two layers: no UPDATE or DELETE
  policy, and `UPDATE`, `DELETE` and `TRUNCATE` are revoked from `anon` and
  `authenticated` (migration `20261021090000_cleaning_records_revoke_mutation.sql`).
  Supabase grants them by default and `TRUNCATE` is not covered by RLS. A
  change attempt now fails with `42501` instead of matching zero rows.
  `service_role` and the table owner are unaffected, so only trusted server
  code or a migration can change the log.
- Two recordings for one job: the unique index on `technician_job_id` lets
  one through and rejects the other with `23505` (`ALREADY_RECORDED`). First
  save wins; the form keeps the user's entry and says it was not saved (see
  "Installation record errors").
- `inspection_records` is kept the same way (FO-F04-S04): no UPDATE or DELETE
  policy, and `UPDATE`, `DELETE` and `TRUNCATE` are revoked from `anon` and
  `authenticated` (migration `20261025090000_inspection_records_revoke_mutation.sql`).
  A change attempt fails with `42501`. `service_role` and the table owner are
  unaffected.
- Covered by the "record cleaning (FO-F03-S01)" tests (update and delete
  denied for every role, concurrent insert, first record kept) and the
  "record inspection (FO-F04-S04)" test for inspections.

## Cleaning and availability (FO-F03-S04)

- **Rule (PRD open question 2).** Cleaning is two steps. `start_cleaning(job)`
  moves the seat `available -> cleaning` and creates the cleaning record in
  the same transaction. `complete_cleaning(job, passed, notes)` records the
  result once: a passed cleaning returns the seat to `available`; a failed
  cleaning, or an unresolved incident (`open` or `investigating`) on the seat,
  moves it to `quarantine` with a reason (`Cleaning failed`, `Unresolved
  incident on the seat`). The status model has no `maintenance` status, so
  `quarantine` is the existing way to hold a seat; a manager releases it with
  `change_seat_status()` (`quarantine -> available`).
- **Start is refused** when the seat is not `available` (`JB008`) or when a
  booking holds or uses the seat in the cleaning period (`JB009`, FO-F03-S09).
  The cleaning period runs from now for two hours (`c_cleaning_period` in
  `start_cleaning()`, migration `20261104090000_cleaning_start_blocks_on_booking_period.sql`),
  and a booking is in the way when it is `pending`, `confirmed`, `assigned` or
  `in_progress`, on this seat, and overlaps that period. This is the same test
  that the booking functions use to allocate a seat
  (`assert_booking_seat_assignable()`), and both lock the seat row, so a booking
  and a cleaning cannot both get through at the same moment. Before FO-F03-S09
  only a booking in force at that moment stopped a start, so a booking that began
  in a few minutes did not. The booking of the job itself is ignored: it is the
  booking the seat was used for. **The two hours are an assumption** until the
  product owner decides what the conflicting period is (spec FO-F03 Q6, ticket
  assumption FO-F03-S09-ASM01): there is no cleaning time in the data, so change
  the one constant to change the rule. The refusal changes nothing: the checks
  come before the seat moves or the record is created, in one transaction. The
  message ("A booking holds or uses the seat in the cleaning period") does not
  name the other booking, which a technician cannot read. A booking that is
  overdue but still `in_progress` has the seat out, and the seat is not
  `available` then, so `JB008` stops it.
  Other errors: `JB005` not a cleaning job, `JB006` job not active, `JB007`
  no seat, `23505` already started, `JB010` not started, `JB011` already
  completed, `JB012` the seat is no longer being cleaned, `22023` result
  missing or notes too long, `P0002` job not found or not the caller's,
  `42501` role not allowed (a partner user).
- **Access.** Both functions are `SECURITY DEFINER` because technicians cannot
  update seats, so each checks the caller itself: the assigned technician, an
  admin or an operations manager. A technician who is not assigned gets
  `P0002`, which does not reveal that the job exists. Execute is granted to
  `authenticated` only.
- **The seat model is shared.** The transitions are reached only through the
  two functions, via the internal `apply_cleaning_seat_status()`, which sets
  the same signals as `change_seat_status()` so `guard_seat_update()` accepts
  the change and the history trigger writes `seat_status_history`. Execute on
  it is revoked from `anon` and `authenticated` (the service role keeps it;
  the tests use it to put a seat back, because the model has no manual way
  out of `cleaning`). `change_seat_status()` and its transitions are
  unchanged. A seat in `cleaning` is not listed by `get_available_seats()`.
- **Immutability.** The completion is the only change a cleaning record ever
  gets, and only `complete_cleaning()` can make it, once. `UPDATE` stays
  revoked from clients (see "Cleaning history").
- **One way in.** `INSERT` into `cleaning_records` is revoked from `anon` and
  `authenticated` (migration `20261023090000_cleaning_records_revoke_insert.sql`):
  a record exists only because `start_cleaning()` created it, so a seat cannot
  be left unmoved. The insert policies and `guard_cleaning_insert()` stay but
  only matter if the grant is ever restored. The job status is not changed by
  either step: a job stays `assigned` or `in_progress` after its cleaning is
  completed.
- **Who can read it.** `cleaning_records_select_technician` now also lets a
  technician read the record of a job assigned to them (migration
  `20261023100000_cleaning_records_select_assigned.sql`). Before, only the
  user who started the cleaning could read it, so a cleaning started by an
  admin or ops user was invisible to the assigned technician, who could then
  never complete it. Admin/ops and partner policies are unchanged; another
  technician still sees nothing (tested).
- **Screen.** `/jobs/[id]/cleaning` has three steps: not started (Start, or
  the reason: the seat status is shown up front, "another booking is using the
  seat" comes from the `JB009` error so the rule lives in one place), in
  progress (Complete with a result that has no default, and notes) and
  completed (read-only with the result). Two people acting at once: the
  second gets "Someone ... first", keeps their entry, and can open the cleaning
  that was kept.
- Covered by the "start and complete cleaning (FO-F03-S04)" tests: seat
  transitions with history, refusals that change nothing, simultaneous starts,
  completion rules, direct INSERT denied for every role, a completed record
  that cannot be changed, and the denial cases for another technician, a
  partner user and the internal helper.

## Cleaning record errors (FO-F03-S05)

- **Conflict.** First save wins; the second is rejected, never merged. Two
  starts for one job: the second gets `23505` ("Someone started this cleaning
  first"). Two completions: the second gets `JB011` ("Someone completed this
  cleaning first. Your result was not saved."), keeps their result and notes
  on screen, and can open the cleaning that was kept. The job row is locked
  inside the functions, so the order is decided by the database.
- **Network failure.** `runJobAction` turns a failed call into
  `NETWORK_ERROR`. The Complete form stays mounted with the result and the
  notes the user chose, and can be submitted again; Start is a button, so it
  can be pressed again.
- **Assignment or permission lost while the screen is open.** Both functions
  re-check the caller on every call. A technician who is no longer assigned
  gets `P0002` (the job looks missing), which the screen shows as "no longer
  available" with a link to the jobs. A user who is deactivated gets `42501`,
  shown as "no longer has access" (tested). The functions also reject a role
  that no longer allows cleaning with the same code; that case is not covered
  by a test.
  Nothing changes in either case: the cleaning stays open and the seat stays
  in `cleaning`. `requireAnyPermission` in the Server Actions is not the
  access check; the functions are.
- Covered by the "start and complete cleaning (FO-F03-S04)" tests: simultaneous
  starts, a second completion, losing the assignment before Start and before
  Complete, and a user deactivated between Start and Complete (only an admin
  can change `is_active`, so the test goes through the admin client).

## Record inspection (FO-F04-S01)

- `/jobs/[id]/inspection` and `recordInspectionAction` require
  `inspections:create` (technician) or `technicians:manage` (admin, ops). The
  "Record work" link is offered only to the assigned technician; hiding it is
  not an access check.
- RLS changed (migration `20261024090000_inspection_record_guard.sql`).
  `inspection_records_insert_technician` now also requires the record's
  `technician_job_id` to be a job assigned to the caller. Before, a technician
  could insert an inspection for any seat (`inspector_id = auth.uid()` was the
  only check; FO-F04-S06 later added the active-technician check). Admin/ops
  keep their policy and a partner user cannot insert.
  `inspection_records_select_technician` also lets a technician read the
  record of a job assigned to them, so a record entered by admin/ops is not
  invisible to the technician. There is no UPDATE or DELETE policy, so a
  recorded inspection is an immutable log row.
- The guard trigger `guard_inspection_records_insert` (SECURITY DEFINER) checks
  values RLS cannot: the job is an inspection job (`JB005`) and active
  (`JB006`), and the booking has a seat that is not retired (`JB007`). It
  overwrites `seat_id`, `booking_id`, `inspector_id` and `inspection_type`
  (`general`), so the client cannot forge them. It runs only when a job is
  given; a row without a job can only come from admin/ops or a trusted server
  insert, never from a technician.
- The Server Action takes the seat from the database (the submitted seat must
  be the booking's seat) and inserts only the job, the result and the notes
  (plus placeholders the trigger overwrites). The result must be one of
  `pass`, `conditional_pass`, `fail`, with no default.
- `inspector_id` is the user who recorded it (`auth.uid()`). One inspection
  per job (unique index). Recording a `pass` or `conditional_pass` does not
  change the seat status or `seats.last_inspected_at`; a `fail` does change
  the seat status (see "Inspection follow-up"). Conflicts, network failures
  and a lost assignment behave as for installations and cleaning.
- Covered by the "record inspection (FO-F04-S01)" tests in
  `src/lib/auth/rls.integration.test.ts`. The retired-seat and no-seat
  branches of the trigger are not covered there (a booking's seat can only be
  changed through the booking functions and a retired seat cannot be
  restored); the page and the seat helper are unit-tested.

## Inspection follow-up (FO-F04-S05)

- **Rule (spec open question Q2).** A `fail` moves the seat to `quarantine`
  with the reason `Inspection failed`, in the same transaction as the insert,
  and `seat_status_history` gets the row from the existing trigger. `pass` and
  `conditional_pass` leave the seat as it is. No incident is created (FO-F05
  owns incidents). A manager releases the seat with `change_seat_status()`
  (`quarantine -> available`).
- **Where it runs.** In `guard_inspection_insert()` (migration
  `20261026090000_inspection_follow_up.sql`), after its checks, so the seat
  moves only for an insert the guard accepts. The seat row is locked first. It
  uses the internal `apply_cleaning_seat_status()`, which clients cannot call.
  The seat is moved from any status except `retired` (the guard already
  refuses that); a seat already in `quarantine` is left alone, with no extra
  history. A seat in `cleaning` is quarantined too; a later `complete_cleaning`
  then fails with `JB012`.
- **Active booking.** When the seat has a booking in `pending`, `confirmed`,
  `assigned` or `in_progress` that has not been returned yet (`return_at >
  now()`, future bookings included), the seat is still quarantined and the
  record says so. Bookings are not changed; a manager decides.
- **`inspection_records.follow_up`** (`seat_quarantined` or
  `seat_quarantined_active_booking`, else null) records what happened to the
  seat. Only the guard sets it: a value sent by a client is overwritten. It is
  part of the immutable log (UPDATE is revoked).
- **Screen.** After a `fail`, `recordInspectionAction` redirects to
  `/jobs/[id]/inspection`, where the read-only record shows a "Follow-up" alert
  (and the active booking warning). Other results redirect to the job as
  before.
- Covered by the "record inspection (FO-F04-S01)" integration tests (fail,
  pass, conditional pass, admin/ops, active booking, seat already in
  quarantine, forged value, rejected duplicate leaves the seat unchanged) and
  the unit tests for the action, the helper and the record component.

## Inspection record errors (FO-F04-S06)

- **Conflict.** First save wins; the second is rejected, never merged. The
  unique index on `technician_job_id` lets one recording through and gives the
  other `23505` ("Someone recorded this inspection first. Your entry was not
  saved."). The form keeps the user's result and notes on screen and can open
  the inspection that was kept. A rejected duplicate does not change the seat.
- **Network failure.** `runJobAction` turns a failed call into
  `NETWORK_ERROR`. The form stays mounted with the result and the notes the
  user chose, and can be submitted again.
- **Assignment or permission lost while the screen is open.** The check is the
  insert policy, not the screen. A technician who is no longer assigned to the
  job gets a denial, shown as "no longer available" with a link to the jobs.
  A technician who is deactivated gets `42501`, shown as "no longer has
  access" (tested). Before this story the technician insert policy did not
  check that the user is still active, so a deactivated technician could still
  record; migration `20261027090000_inspection_insert_requires_active_technician.sql`
  now requires `current_user_role() = 'technician'` (which is null for an
  inactive user). Admin and operations manager already used
  `is_admin_or_ops_manager()`, which has the same check. Nothing is stored and
  the seat is not changed in either case. `requireAnyPermission` in the Server
  Action is not the access check; the policy is.
- Not covered: a technician whose role was changed to another role while the
  screen was open (the shared test technician's role is not changed by the
  tests); the policy rejects it the same way as a deactivated user. The
  technician SELECT policy still lets a deactivated user read their own
  records; that is outside this story.
- Covered by the "record inspection (FO-F04-S01)" tests: simultaneous
  recordings (one row), a rejected duplicate, losing the assignment before
  saving, and a technician deactivated before saving (only an admin can change
  `is_active`, so the test goes through the admin client). The form tests cover
  the conflict, network and access messages.

## Report incident (FO-F05-S04)

- **Who.** `/incidents/new` and `reportIncidentAction` require
  `incidents:report` (technician) or `incidents:view` (admin, operations
  manager): `INCIDENT_REPORT_PERMISSIONS`. The permission matrix is unchanged;
  the operations manager still has no `incidents:report`. A partner user
  cannot report (spec Q2 is still open). Who may open the list and the detail
  is described under "Incident access scope (FO-F05-S07)". Hiding a button is
  not an access check.
- **Related job.** The incident is tied to a job, because a seat has no partner
  and `incidents.partner_id` is not null; the job carries the booking, the seat
  and the partner. The choices are the jobs RLS gives the user (a technician's
  own, every job for a manager), cancelled jobs left out, newest first, at most
  100.
- **What the client sends.** Only the job, the severity (no default) and the
  description (required, trimmed, at most 1000 characters). Validation is the
  same Zod schema on the client and in the Server Action.
- **The database decides the rest** (migration
  `20261028090000_incident_report_guard.sql`). The guard trigger
  `guard_incidents_insert` (SECURITY DEFINER, before insert) derives
  `booking_id`, `seat_id` and `partner_id` from the job, sets `type` to the job
  type and `reported_by` to the caller, and forces `status` open with no
  resolver. A technician who is not assigned to the job gets `P0002`, the same
  as for a job that does not exist. Rows without a job (admin/ops or a trusted
  server insert) are not changed.
- **RLS changed.** `incidents_insert_technician` now also requires an active
  technician (`current_user_role() = 'technician'`), a job, and that job
  assigned to the caller. Before, a technician could cite any job or seat, and
  a deactivated technician could still insert (the same gap that was closed for
  inspections). Admin/ops keep their policy and a partner user cannot insert.
  The booking status of the job is not checked, so an incident can be reported
  on a completed job.
- **After saving.** The reporter is taken to the incident detail (FO-F05-S07
  lets a technician open the incidents they reported; at first they went back
  to the job). Cancel goes to the incident list. A technician reaches the form
  from the "Report incident" link on the job detail, which selects that job.
- **Errors.** `P0002` shows as "no longer available", `42501` as "no longer has
  access", a network failure keeps the user's input (same handling as the work
  records). Raw database messages never reach the client.
- Covered by the "report incident (FO-F05-S04)" integration tests (own job,
  forged values overwritten, admin and ops, another technician's job, unknown
  job, no job, deactivated technician, partner user, severity outside the
  enum) and the unit tests for the schema, the action, the form and the pages.

## Incident status and severity models (FO-F05-S05)

- **One source of truth.** The Postgres enums `incident_status` (`open`,
  `investigating`, `resolved`, `closed`) and `incident_severity` (`low`,
  `medium`, `high`, `critical`) are the models. The app takes its lists from
  the generated types (`Constants.public.Enums`), so they cannot drift; a test
  compares them with the migration, and a new value fails type-checking until
  it gets a label.
- **Where a value is checked.** The report form and the Server Action accept
  only a severity from the enum (Zod) and never a status: the guard trigger
  opens every reported incident as `open`. The list filters drop a status or
  severity outside the enum. The database is the last layer: a value outside
  the enum is rejected with `22P02` on insert and on update, and the row is
  left unchanged.
- **Updates.** Only an admin has an UPDATE policy on `incidents`. Which status
  changes are allowed, and who may make them, is decided by
  `change_incident_status()` (see "Update incident status (FO-F05-S06)").
- Covered by the "incident status and severity models (FO-F05-S05)"
  integration tests (every status and severity saved, values outside the enum
  rejected on insert and update, a status sent when reporting ignored) and the
  enum tests in `src/features/incidents/lib/incident-enums.test.ts`.

## Update incident status (FO-F05-S06)

- **Rule (spec open question Q1).** The status changes only through
  `change_incident_status(incident, from_status, to_status, note)`:
  `open` to `investigating` or `resolved`; `investigating` to `resolved`;
  `resolved` to `closed`, or back to `investigating` (reopening, which needs a
  note); `closed` is the end. Becoming `resolved` sets `resolved_by` and
  `resolved_at`; reopening clears them; closing keeps them. The lists in
  `incident-status.ts` mirror the function, which is the authority.
- **Who.** An active admin or operations manager. The function is SECURITY
  DEFINER and checks the caller itself, because the UPDATE policy on
  `incidents` is admin-only and was not widened. A technician or a partner user
  gets `42501`. The page offers the control only to `incidents:view` holders and
  only when a transition exists; hiding it is not the access check.
- **No shortcut.** A trigger rejects a direct change of `status`,
  `resolved_by` or `resolved_at` (`55000`), admin included. Other columns are
  unchanged by this story.
- **Stale data.** The caller sends the status they were looking at. If the
  incident moved on, the function raises `JB004` and the screen refreshes, so
  a second person never overwrites the first without seeing it. The row is
  locked, so two simultaneous changes let one through.
- **History.** `incident_status_history` keeps one row per change (who, from,
  to, note, time), written by a trigger in the same transaction. It is
  append-only: no policy lets a client insert, update or delete, and a trigger
  rejects any change or delete, service role included. It follows that an
  incident with history cannot be deleted. Only admin and operations manager
  read it; FO-F05-S07 kept it that way (technician and partner users read no
  history).
- **Errors.** `42501` "no longer has access", `P0002` "not found or not within
  your access", `55000` invalid transition, `JB004` changed by someone else,
  `22023` missing or too long note. Raw database text never reaches the client.
- Covered by the "update incident status (FO-F05-S06)" integration tests (the
  full path, resolver set and kept, reopen with and without a note, invalid
  transitions, stale data, two simultaneous changes, technician, partner and a
  deactivated manager, direct updates blocked, append-only history, who can read
  it) and the unit tests for the transitions, schema, action, dialog, history
  and detail page.

## Incident access scope (FO-F05-S07)

- **Who sees which rows.** RLS on `incidents` decides; the screens never
  filter for access. Admin and operations manager read every incident. A
  partner user reads the incidents of their own partner (`partner_id =
  current_user_partner_id()`), and none when inactive because that function is
  then null. A technician reads the incidents they reported and those reported
  on a job assigned to them, and only while active.
- **RLS changed** (migration `20261030090000_incident_select_scope.sql`).
  `incidents_select_technician` now requires an active technician
  (`current_user_role() = 'technician'`) and adds the assigned-job case. Before,
  a deactivated technician could still read their incidents, and an incident
  on their job reported by someone else was invisible to them.
- **Who may open the screens.** `INCIDENTS_ACCESS_PERMISSIONS` is an any-of set
  (`incidents:view`, `operations:view_own_partner`, `incidents:report`): the
  list, the detail and the menu link are offered to managers, partner users and
  technicians. The permission matrix is unchanged. Reporting still needs
  `incidents:report` or `incidents:view`, and changing a status
  `incidents:view` plus the database function, so a partner user is read-only.
- **What each role sees on the detail.** A partner user gets no staff names (the
  reporter and the resolver), no link to the job (they have no access to the
  jobs) and no status history, and the page does not query the history for them.
  A technician gets the job link but no history and no status control. Only a
  manager sees the history and the Update status button. An incident outside
  the user's scope, a missing one and a malformed id all show the same
  forbidden state.
- **After reporting**, every reporter is taken to the incident they made.
- Covered by the "incident access scope (FO-F05-S07)" integration tests
  (partner A and partner B each see only their own and cannot open the other's
  by id, a deactivated partner user or technician sees nothing, the technician
  sees the reported and the assigned ones and not another's, admin and ops see
  all, a partner user cannot read the history or change a status) and the unit
  tests for the permissions, the menu, the pages and the detail.

## Incident seat reference (FO-F05-S08)

- **Rule (spec E1).** An incident keeps the seat it refers to when the seat is
  deactivated. A seat is never deactivated by a flag: it is retired (`status`
  `retired`, terminal), and the app has no way to delete a seat. Retiring one
  does not touch `incidents`, so the incident stays visible and its `seat_id`
  stays.
- **The reference cannot be dropped by a delete.** `incidents.seat_id` was `ON
  DELETE SET NULL`, so a delete done by maintenance or a service role would
  have removed the reference silently. Migration
  `20261031090000_incident_seat_reference_restrict.sql` makes it `ON DELETE
  RESTRICT`, like `inspection_records`, `cleaning_records` and
  `seat_status_history`: such a delete fails with `23503` and the reference is
  kept. `booking_id` and `technician_job_id` keep `ON DELETE SET NULL`.
- **Screens.** The list and the detail show the serial number of the seat and
  mark a retired seat, for example `SN-2 (Retired)`. Who can read the seat row
  is unchanged (seats RLS): a partner user and a technician see it through
  the booking they have access to.
- Covered by the "incident seat reference (FO-F05-S08)" integration tests (the
  incident and its `seat_id` after the seat is retired, read by admin, ops, the
  partner of the booking and the assigned technician with the seat marked
  retired, another partner still gets nothing, a delete of a referenced seat is
  refused) and the unit tests for the list, the detail and the formatter.

## Incident errors (FO-F05-S09)

- **Conflict.** First change wins, never merged. Changing a status sends the
  status the user was looking at; if the incident moved on, the function locks
  the row and raises `JB004` ("changed by someone else"), the page refreshes to
  the latest status, and the second person looks again and retries. Two
  simultaneous changes let exactly one through. Reporting has no conflict: more
  than one incident for the same job is valid.
- **Network failure.** `runJobAction` turns a failed call into `NETWORK_ERROR`.
  The report form and the status dialog stay mounted with what the user typed
  (job, severity, description, new status, note) and can be submitted again. The
  alert says the input is kept and offers no way out of the form.
- **Permission or assignment lost while the screen is open.** The check is made
  again on every call, in the database. A technician whose job was given to
  someone else gets `P0002` when reporting; a technician or a manager who is
  deactivated gets `42501` (tested). The alert says "no longer available" or "no
  longer has access" and points back to the incident list. Nothing is stored:
  no incident and no history row. `requireAnyPermission` in the Server Actions
  is not the access check; the policy and the function are.
- **Messages.** `IncidentActionErrorAlert` and `mapIncidentError` talk about the
  incident, never about a job, and raw database text never reaches the client.
  A retry can fix `STALE_DATA`, `INVALID_TRANSITION` and a network failure; for
  `NOT_FOUND` and `FORBIDDEN` the only way on is back to the list.
- Not covered by a test: clicking through the dialog in a browser (the hook that
  refreshes the page after `JB004` has no unit test, as for the job status
  dialog); the database and the alert are tested on their own.
- Covered by the "update incident status (FO-F05-S06)" and "report incident
  (FO-F05-S04)" integration tests (simultaneous changes, stale status, a
  deactivated manager or technician, a job given to someone else) and the unit
  tests for `IncidentActionErrorAlert`, `mapIncidentError` and the report form.

## Operations dashboard (VI-F01-S01)

- **Where.** `/dashboard`, the page users land on after signing in, and a
  "Dashboard" link in the menu for every role. `requireAnyPermission` with
  `DASHBOARD_ACCESS_PERMISSIONS` (`dashboards:view`, `jobs:view_assigned`,
  `operations:view_own_partner`) is the access check; the permission matrix is
  unchanged. `/admin` ("Admin Operations") is a separate placeholder and was not
  touched.
- **What a figure is.** The number of rows of one table that match a filter, as
  the viewer's RLS scope returns them: one `count` query per figure, run when
  the page loads (no refresh interval, no stored value, no hardcoded value). The
  service role is never used, so the scope is the viewer's, not the app's.
  Source: `src/features/dashboard/lib/dashboard-metrics.ts`. The table below
  is checked against that file by `dashboard-formulas-doc.test.ts` (label,
  table, rule and link), and each written formula must name the values it
  filters on, so a change to a metric must change the table too (VI-F01-S05).

  | Figure | Table | Rule (column = value) | Drills into |
  |---|---|---|---|
  | Available seats | `seats` | `status = available` | `/seats?status=available` |
  | Quarantined seats | `seats` | `status = quarantine` | `/seats?status=quarantine` |
  | Pending bookings | `bookings` | `status = pending` | `/bookings?status=pending` |
  | Bookings in progress | `bookings` | `status = in_progress` | `/bookings?status=in_progress` |
  | Assigned jobs | `technician_jobs` | `status = assigned` | `/jobs?status=assigned` |
  | Jobs in progress | `technician_jobs` | `status = in_progress` | `/jobs?status=in_progress` |
  | Open incidents | `incidents` | `status = open` | `/incidents?status=open` |
  | Critical open incidents | `incidents` | `status = open` and `severity = critical` | `/incidents?status=open&severity=critical` |

- **Who sees what.** A figure is shown to the roles that can open the list it
  drills into. Admin and operations manager get all eight. A technician gets the
  jobs and incidents in their scope. A partner user gets the bookings and
  incidents of their own partner and no seat or job figure; they see them on the
  partner home (`/partner`), because `/dashboard` sends a partner user there. A
  partner user who is inactive counts zero, because the scope is then empty.
- **Same rule as the list (spec E3).** The filter pairs of a figure are also the
  query string of its link, so the count and the list use one rule. The
  integration tests check each figure against the total of the list select.
- **Charts (VI-F01-S07).** Under the cards of each group there is a chart of the
  same data as horizontal bars: seats, bookings and jobs by status, and open
  incidents by severity (Critical first, with an icon and a heavier label, red
  only when it has something to count). Source: `dashboard-charts.ts`,
  `get-dashboard-charts.ts`, `dashboard-chart.tsx`.
  - *Same count as the card.* A bar is the number of rows of one table that match a
    filter, counted with the same function as the cards (`countMetric`), in the
    scope of the viewer's RLS. A bar that has a card with the same filters has the
    same number, and the open incidents by severity add up to the open incidents
    card. The integration test `dashboard-charts.integration.test.ts` checks this
    for the seven demo accounts, and that the two partners do not see each other's
    rows. The cards are kept beside the chart (spec Q6).
  - *Who sees which chart.* The roles that see the cards of the group: admin and
    operations manager all four, a technician jobs and incidents, a partner user
    bookings and incidents (on the partner home). A module that is not released has
    no chart and no query.
  - *Never colour alone (R8).* Every bar is a row with its word, its count and its
    share; the drawn bar is hidden from a screen reader. The tone of a bar repeats
    the tone of the status badge.
  - *No chart of zeros (E6).* A group whose counts are all zero shows "No ... to
    chart yet", and a group with a count that could not be read shows Unavailable.
    Inside a chart that has data, a bar of 0 is a real zero and is shown.
  - *Width (R9).* The bars take the width of their card and the labels wrap: no
    sideways scroll at 320 or 375 px. The width of a bar is a CSS custom property.
  - *No library (spec Q5).* The charts are HTML and Tailwind, drawn on the server,
    so no chart library is added. The choice of library and chart type is open (Q5);
    the bars are a text list that a chart library could replace.
  - *Cost.* A chart takes one count query for each bar, run in parallel: 22 for an
    admin, in addition to the 8 of the cards. The number does not grow with the rows.
- **Drill-down (VI-F01-S02).** Selecting a tile opens the list it counts, with the
  filter of the figure in the link. Three things keep the count and the list on
  one rule, and a mismatch is a defect:
  - the link is built from the same filter pairs as the count, and a unit test
    parses every link with the parser of the destination list page and checks
    that exactly those filters survive (a list drops a filter it does not
    recognise, which would silently widen the list);
  - the lists add no hidden filter of their own, only the ones in the link;
  - an integration test runs the real list function (`getSeats`, `getBookings`,
    `getJobs`, `getIncidents`) with the client of each role and compares its
    total with the figure: admin, operations manager, partner A, partner B and
    technician.
  A role is never taken to a list it cannot open, because the tile is not shown
  to it; the list also guards itself, so a typed address is refused.
- **Data gaps (VI-F01-S03).** Nothing is ever shown as 0 unless it was counted
  as 0. There are three kinds of gap, and each says what it is:
  - *A figure that could not be read* shows "Unavailable" and the page adds a
    note; if none could be read it says so.
  - *A module that is not released* (`DASHBOARD_MODULE_RELEASED` in
    `dashboard-metrics.ts`; all four are released today) is not queried at all:
    its figures show "Not available yet", with no number and no link, and the
    page adds a note. Such a figure is neither a zero nor a failed read, so it
    does not make the dashboard "empty" or "partial".
  - *A partner user who is not linked to a partner* gets no rows from RLS, so
    every figure would be 0. Such a user is not shown a dashboard at all: they are
    sent to the "Access denied" page that says "Your account is not linked to a
    partner yet" (VI-F03-S05, below).
  When every figure that was read is zero the page says there is no operational
  data yet. Loading and error states use the shared components.
- **Role scope (VI-F01-S04).** The role only chooses which figures are shown
  (`getMetricsForRole`); it is not the tenant boundary. Every count runs with
  the viewer's own client, so RLS decides the rows. Tests prove it:
  - a raised role (`admin` metrics read with a partner's or a technician's
    client) gives the same figures as the honest role and never the platform
    total;
  - a partner user with no partner counts zero from the scope;
  - for every role, a figure is shown only if the role holds a permission of
    the list it opens (`it.each(ROLES)`, so a new role is caught);
  - for every role, a menu link is shown exactly when the module behind it
    opens for that role (`src/config/nav-access.test.ts` runs each module's
    real guard with the real permission rules). Menu and guard cannot drift.
  No role is refused the dashboard today: managers, technicians and partner
  users may all open it.
- **Errors (VI-F01-S06).** Two different failures, shown differently:
  - *The network or database fails while loading* (spec E4). A figure that
    could not be counted shows "Unavailable" and the page note carries a "Try
    again" button that runs the page again (`router.refresh()`, so every figure
    is counted again; nothing is cached on the client). If the profile of the
    user cannot be read, `getCurrentUser` throws in the `(dashboard)` layout;
    a layout's error is caught by the boundary above it, `src/app/error.tsx`,
    which shows "Could not load this page" with "Try again". Such a failure is never shown as
    "forbidden": it says nothing about permission. It also never grants
    access, and the raw error is not shown.
  - *Permission is revoked while the screen is open* (spec E5). Every request
    reads the profile again, so the next request of a deactivated user is sent
    to `/forbidden`, even though the session token is still valid. "Try again"
    is a new request, so a revoked user lands on `/forbidden` too.
  `getCurrentUser` returns `null` (forbidden) only for a missing row or an
  inactive profile; any other read error is thrown. This holds for every area
  that uses `requireAuth`, not only the dashboard.
- Not in this story: financial figures, KPIs with targets and AI analysis
  (VI-F04 to VI-F06), and a refresh interval (spec Q3: computed on load).
- Covered by the "dashboard metrics (VI-F01-S01)" integration tests (platform
  counts for admin and ops, partner A and partner B each counted over their own
  partner, a technician over their own jobs, count equals list total, a
  deactivated partner user counts nothing) and the unit tests for the metric
  definitions, the count query, the page states and the tiles.

## Partner home (VI-F03-S01)

- **Where.** `/partner`, guarded by `bookings:view_own_partner` in the layout and
  in the page. Every sign-in lands on `/dashboard`; for a `partner_user` that
  page redirects to `/partner` after its own access check, so login, signup,
  email confirmation and password reset all end on the partner home with one
  rule. The other roles stay on the dashboard.
- **Scope (spec R6).** The partner is the one on the signed-in user's profile,
  never a value from the URL or the form. The name and code come from one read
  of `partners` (`name, code` only, no contact or commercial data), and RLS
  returns only the user's own row: asking for another partner's id gives
  nothing. The figures are the partner figures of the dashboard (pending
  bookings, bookings in progress, open and critical incidents), so the formulas
  are the ones documented above. The raw partner id is not shown.
- **States.** Loading (`loading.tsx`), error with retry (`error.tsx`, and the
  Unavailable note with "Try again" for figures that could not be read), empty
  (every figure read and zero), forbidden (the guard), and an account with no
  partner (never gets here: VI-F03-S05, below). A partner row that cannot be seen
  says "Your partner could not be found".
- **Navigation (spec R2).** A Bookings card opens `/bookings`, the list a partner
  user can already open (read-only, their partner's rows by RLS). A Seats card
  opens `/partner/seats` (VI-F03-S04, below). A view that is not released has
  `href: null` in `PARTNER_HOME_ITEMS` and shows "Not available yet" without a
  link, so the home never points at a page that is not there. Booking actions
  for partners are VI-F03-S03.
- Covered by unit tests (page states, navigation, summary read, redirect from the
  dashboard) and the "partner home (VI-F03-S01)" integration tests (each partner
  reads its own summary, another partner's id gives nothing, no partner and
  technician read nothing).

## Partner bookings (VI-F03-S02)

- **Where.** The partner bookings view is `/bookings`, reused as the spec allows
  (R3). A partner user reaches it from the Bookings card of the partner home and
  gets a "Back to Partner home" link (spec NAV-3) to `/partner`. The link shows
  only to someone who cannot manage bookings; admin and operations manager do
  not come from the partner home and do not see it. Booking detail has no such
  link.
- **Scope (spec R3, R6).** The list lists only the signed-in partner's bookings,
  and RLS decides which rows exist for the user. The query schema has no partner
  filter, so a partner id typed into the address is dropped, and a search for
  another partner's booking number lists nothing. A partner user with no partner
  is listed nothing. No finance column is selected.
- **States.** Loading, error with retry, empty, success and forbidden are the
  ones of the bookings list. A partner user with no partner is sent to the
  no-partner page before the list is read (VI-F03-S05, below).
- Covered by the unit tests of the page (the way back, per role) and the
  "partner bookings (VI-F03-S02)" integration tests (each partner is listed all
  of their own bookings and none of the other's, search and address tampering,
  filters and sorting, no partner).

## Partner creates and edits bookings (VI-F03-S03)

- **Who.** A new permission, `bookings:manage_own_partner`, is given to
  `partner_user` (the matrix above and `BOOKINGS_WRITE_PERMISSIONS`). "Where
  authorized" means: an active partner user whose partner is active. Admin and
  operations manager keep `bookings:manage` and the existing screens.
- **How the write is done.** Only through two new database functions,
  `create_partner_booking()` and `update_partner_booking()`
  (`20261101090000_partner_booking_rpcs.sql`), called by the Server Actions
  `createPartnerBookingAction` and `updatePartnerBookingAction`. **No INSERT or
  UPDATE policy was added on `bookings` for partner users**, so a direct write
  through the API is still refused, and the booking guard triggers still hold.
- **Why `SECURITY DEFINER`.** The availability check must count the seats and
  the bookings of every partner, which RLS hides from a partner user, so a
  `SECURITY INVOKER` function would give a wrong answer. This is a reviewed
  exception to "RLS is the boundary", kept as small as it can be:
  - each function checks the caller itself: an active `partner_user` with an
    active partner (`current_partner_user_partner_id()`), else `42501`;
  - the partner is never an argument: it is the caller's own;
  - a booking of another partner is `P0002` not found, the same as one that
    does not exist; messages never name another partner's booking;
  - the capacity helper (`partner_booking_free_seats()`) returns one number and
    cannot be called by a signed-in user; both helpers are revoked from
    `public`, `anon` and `authenticated`;
  - `search_path` is empty, and the cross-partner denial is tested.
- **Rules.** The status is always `pending`; the number is generated. A partner
  user picks no seat (operations assign it later). Availability is by capacity:
  the seats that are available for the airport and category, minus the active
  bookings that overlap the period (assigned or not); touching endpoints do not
  overlap; if none is free the error is `BK006` ("No seat is available...").
  Creates for one airport and category are serialized with an advisory lock.
- **Edit.** Only a `pending` booking of the caller's partner (`55000` otherwise),
  with the lost-update guard (`BK004`). The airport, category, rate, status,
  number and seat are not arguments. If the schedule changes, the capacity is
  checked again without counting this booking, and a seat that operations
  already assigned must still be free (`BK002`).
- **Daily rate.** The partner user enters the daily rate when creating, as the
  manager form does, and it is read-only afterwards. This feeds the settlement
  later (VI-F04), so the rate a partner enters is a risk to review there; it was
  accepted as the only source for the rate today.
- **Not in this story.** Cancelling a booking and choosing a seat.
- Covered by unit tests (schemas, actions, RPC arguments, error mapping, pages,
  forms, detail) and the "partner creates and edits bookings (VI-F03-S03)"
  integration tests (own partner only, no partner argument, every other caller
  refused, edit of another partner's booking not found, confirmed booking not
  editable, no direct write, helpers not callable, capacity and touching
  periods, suspended partner).

## Partner seats (VI-F03-S04)

- **Where.** `/partner/seats`, in the partner area: the layout guards
  `bookings:view_own_partner` and the page guards `seats:view_own_partner`. It is
  reached from the Seats card of the partner home, and has a "Back to Partner
  home" link (spec NAV-4). The admin seats list (`/seats`, `seats:manage`) is not
  used and a partner user cannot open it.
- **Scope (spec R5, R6).** RLS decides: `seats_select_partner_user` gives a
  partner user only the seats assigned to a booking of their own partner (a seat
  stays visible while a booking of the partner points at it, past bookings
  included). The query adds no `partner_id` filter, and the address schema
  (`partnerSeatsQuerySchema`) has no partner, airport or category key, so
  putting one there changes nothing. A partner user with no partner never
  gets here: they are sent to the no-partner page (VI-F03-S05, below).
- **Read-only, and only what a partner needs.** A row has the serial number, the
  status, and the category and airport names. The list never selects the public
  token, manufacturer, model, dates, rental cycles or the quarantine reason; the
  search matches the serial number only. The table has no link to a seat and no
  action.
- **States.** Loading (`loading.tsx`), error with retry (`error.tsx`; a failed
  read is thrown, never shown as an empty list), empty ("No seats yet" when
  unfiltered, "No seats found" when a search or status is active), success, and
  forbidden (the guards). The search and status filter is a plain GET form, so
  there is no client component.
- Covered by unit tests (address schema, filters, links, the read, table,
  filters, pagination, page and its states) and the "partner seats
  (VI-F03-S04)" integration tests (each partner is given exactly the seats of
  their own bookings, another partner's seat cannot be found by serial, address
  tampering changes nothing, no internal column, no partner).

## Partner scope (VI-F03-S05)

- **Where the scope comes from (spec R6).** Only from the signed-in user's own
  profile row in `public.users`, read by their verified id (`getCurrentUser`),
  and from RLS, which reads the same row. It never comes from the address, a
  form, a Server Action argument, or a claim in the token. `create_partner_booking`
  and `update_partner_booking` have no partner argument; the seats address schema
  has no partner, airport or category key; the pages read `user.partner_id`. An
  integration test moves a user to another partner and then to none in the
  database, and shows that what they are given changes on the next request
  without a new sign-in.
- **No partner means no access (spec E2).** `requireAuth()` is the one door of
  every signed-in area, so it holds the rule: a `partner_user` whose profile has
  no partner is sent to `/forbidden?reason=no_partner` ("Access denied", "Your
  account is not linked to a partner yet... ask an administrator", and the
  sign-out button). That covers the dashboard, bookings, incidents, the partner
  home and every route added later, and it fails closed. Admin, operations
  manager and technician have no partner by design and are not affected. A new
  sign-up is a partner user with no partner, so it lands on this page until an
  administrator links the account. `requirePartnerScope(permission)` is for the
  partner pages themselves: it also sends anyone with no partner (an admin, for
  example) to the same page, because the portal is per partner, and it narrows
  `partner_id` to a string for the page. The page only recognizes the fixed
  reason `no_partner`; any other value in the address gets the generic text.
- **An address to another partner's record (spec E3).** `/bookings/<id>`,
  `/bookings/<id>/edit` and `/incidents/<id>` read the record through RLS, so the
  record of another partner is not there for the user. The pages answer with the
  standard not-found page, the same as for an id that does not exist, so the
  answer does not say whether the id exists. Integration tests compare the two
  cases and the booking events, and compare the error of an edit of another
  partner's booking with the error of an edit of a booking that does not exist.
  The record's id and details are not in the answer.
- **Not changed.** No new table, policy, migration or permission. The deactivated
  partner (VI-F03-S07) and finance (VI-F03-S06) are their own stories.
- Covered by unit tests (the rule in `requireAuth` and every guard built on it,
  `requirePartnerScope`, the forbidden page and its reasons, the partner pages) and
  the "partner portal scope (VI-F03-S05)" integration tests.

## Partner finance (VI-F03-S06)

- **State: not released.** Partner finance depends on VI-F04, which has no spec or
  code yet, so there is no finance screen. The story therefore adds only the
  switch and the proof. `PARTNER_FINANCE_RELEASED` (`partner-home-items.ts`) is
  `false`: the partner home shows a Finance card as "Not available yet", with no
  link, and there is no finance route (a test fails if a link points at a page
  that is not there, or if a finance page appears while the flag is off). The card
  is offered only to a role that holds `finance:view_own_partner`
  (`partner_user`). The acceptance criterion ("when finance is released, only the
  relevant partner's information") cannot be seen end to end until VI-F04 exists.
- **Already true at the data level (spec R7).** `settlements`, `invoices` and
  `partner_commercial_terms` have RLS that gives a partner user only the rows of
  their own partner and no write. The "partner finance scope (VI-F03-S06)"
  integration tests show it for each table: each partner gets its own rows and
  none of the other's (by list and by id), a partner with no partner and a
  technician get none, and a partner cannot insert, change or remove a row, their
  own included.
- **What VI-F04 must do when it releases finance** (the contract):
  1. read through RLS with the user's own client, and guard the route with
     `finance:view_own_partner` (`requirePartnerScope`, so a user with no partner
     never gets there);
  2. name the columns: no `select *`. `partner_commercial_terms` holds the
     platform's share and fees, so a partner view must choose what it shows;
  3. turn the flag on in the same change, add the route, and add the isolation
     tests for what it reads.
- **"Visible" means the screen.** A partner user can already read their own
  finance rows through the API, because RLS allows it; nothing hides them before
  release. Gating the rows in the database until release was not done here: it
  needs a release setting in the database and is for VI-F04 to decide.

## Deactivated partner (VI-F03-S07)

- **The rule (spec E1, decided here).** A partner user can use the portal only
  while their partner is `active`. `pending`, `suspended` and `inactive` are all
  refused, the same as `create_booking` already required for an operations
  booking. It holds while the user is signed in: the check is made at every
  request, so the next request after the partner is deactivated is refused,
  with no need to sign in again. Admin, operations manager and technician are
  not affected, and operations can still see the partner and its bookings.
- **Two layers, both fail closed.**
  1. *Database.* `current_user_partner_id()` (migration
     `20261102090000_current_user_partner_requires_active_partner.sql`) returns
     the partner only when the partner is `active`. Every partner policy is built
     on it (bookings, seats, incidents, jobs, finance, and the `partners` row), so
     the users of a partner that is not active get no rows through the API either,
     and the booking functions refuse them (`42501`). The change only narrows: no
     case that returned `null` before returns a partner now.
  2. *Application.* `requireAuth()` reads the profile together with the status of
     the partner in one query (`partner:partners(status)`; no extra round trip) and
     `getPartnerAccessIssue()` (pure) returns `partner_inactive` when the status is
     not `active`. The user is sent to `/forbidden?reason=partner_inactive`:
     "Your organization's account is not active... Contact your administrator",
     with the sign-out button. When the partner row cannot be read (the database
     hides it from its own users once it is not active) the answer is the same,
     not a pass. The message does not say which status the partner has.
- **What a user sees.** Sign-in lands on `/dashboard`, whose layout goes through
  `requireAuth`, so the user gets the message at once and never sees a screen
  that would fail or be empty. A partner with no partner at all keeps its own
  message (`no_partner`, VI-F03-S05).
- **Rollout.** Apply the migration with the code. Code without the migration still
  shows the message but the API would still return the partner's rows.
- Covered by unit tests (the rule per status and per role, `requireAuth` and every
  guard built on it, the check at every request, one query for profile and
  status, the forbidden page) and the "deactivated partner (VI-F03-S07)"
  integration tests (the scope function, every portal read returning nothing for
  each status with a session opened before, another active partner unaffected,
  booking functions refused, operations unaffected).

## Partner portal errors (VI-F03-S08)

- **Network or database failure while loading (spec E4).** Every page a partner
  user can open has an error boundary of its own segment (`error.tsx`, a client
  component with "Try again" that never prints the error message); a structural
  test fails if a portal page has none. A failed read is thrown to that boundary,
  never shown as an empty list or a zero: the partner home and seats page throw, a
  figure that could not be counted shows "Unavailable" with a retry, and a failed
  profile read in a layout is caught by `src/app/error.tsx` (VI-F01-S06). None of
  these is shown as "forbidden".
- **Network failure while saving.** The booking forms (create, edit, change
  status, and the partner versions) call their Server Action through
  `runBookingAction()`: a call that fails because the network is down becomes a
  `NETWORK_ERROR` result inside the form ("Could not reach the server. Your input
  is kept..."), so the user keeps what they typed and can submit again. It is never
  taken as a success, and the raw failure is not shown. A Next redirect or
  not-found is re-thrown, so navigation, including the one to `/forbidden`, still
  happens.
- **Permission revoked while a screen is open (spec E5).** The next request is
  refused by three independent paths, each tested on a session opened before the
  change:
  1. every page and Server Action goes through `requireAuth()` (profile, role,
     partner and partner status read again), which sends the user to `/forbidden`;
  2. the database gives the user no rows: `current_user_partner_id()` (migration
     `20261103090000_current_user_partner_requires_partner_role.sql`) now returns
     a partner only to an active `partner_user` of an active partner, so changing a
     partner user to another role (with the partner left on the profile),
     deactivating the account, taking the partner off the profile, or
     deactivating the partner all end the access at the next request;
  3. the partner booking functions refuse the caller (`42501`), and the two partner
     Server Actions turn that into a redirect to `/forbidden`, the forbidden state,
     not a message in the form.
- **Rollout.** Apply the migration with the code.
- Covered by unit tests (`runBookingAction`, the actions' `42501` redirect, the
  boundaries of the portal pages) and the "partner portal permission revoked
  while open (VI-F03-S08)" integration tests (role changed, account deactivated,
  partner taken off the profile; another partner's session unaffected).

## Installation record errors (FO-F02-S05)

- Conflict: the form keeps the user's entry on screen and says "Someone
  recorded this installation first. Your entry was not saved." The page
  switches to the recorded installation only when the user asks for it. The
  message names nobody; the record is shown only if RLS lets the user read it.
- Network failure: `runJobAction` turns a failed call into `NETWORK_ERROR`;
  the form stays mounted with its input and can be submitted again.
- Assignment or permission revoked while the screen is open: the action
  returns `NOT_FOUND` (RLS hides the job) or `FORBIDDEN`, the form shows "no
  longer available" with a link to the jobs, and the database rejects the
  insert anyway (the RLS test "loses the assignment").

## Installation and seat status (FO-F02-S04)

- Recording an installation does not change the seat status. The seat status
  model (`change_seat_status()`) defines no status that follows an
  installation: `reserved`, `in_use`, `cleaning` and `inspection` belong to
  later workflows, and the spec's resulting status is still open. When it is
  decided, the change must go through the same model so it writes
  `seat_status_history`.
- A seat that is not `available` or `reserved` is rejected with `JB007` by
  `guard_installation_insert`. The screen also reads the seat status and says
  so instead of showing the form (`INSTALLABLE_SEAT_STATUSES` in
  `src/features/installations/lib/seat-eligibility.ts`, which must stay in
  sync with the trigger). The trigger remains the enforcing authority: the
  status can change after the page loaded.
- Tests: "record installation" in `src/lib/auth/rls.integration.test.ts`
  checks the seat status and history do not change, on success and on a
  rejected insert.

## Start cleaning from a QR scan (FO-F03-S11)

- **A scan only opens a page.** `/seats/[id]/cleaning` reads the open cleaning jobs of the
  seat and sends the person to the cleaning panel of the job (`/jobs/[id]/cleaning`). It
  imports no action and calls neither `start_cleaning()` nor `complete_cleaning()`. A cleaning
  starts only when the person presses Start on the panel (AC02).
- **Access is checked on the server first.** The page calls `requireAnyPermission` with
  `CLEANING_RECORD_PERMISSIONS` before any query (AC04). RLS then limits the jobs: a technician
  gets their own jobs, an internal role gets all. A seat with no job the person can see gives
  the same refusal as an unknown seat, so a scan does not show whether a seat exists.
- **Return after sign in (AC03).** The proxy sends a signed-out request to
  `/login?next=<path>`. The path comes from the address, so it is not trusted: `safeNextPath`
  accepts only a path of this app (one leading slash, no backslash, space or control
  character, same origin, not `/login`, `/signup`, `/forgot-password`, `/reset-password`,
  `/forbidden` or `/api`). The login page and the login action both check it; anything else
  goes to the dashboard. Signing in performs nothing but the redirect.
- **The QR scan route is a separate story.** `/q/[token]` (CO-F04-S13, see "Open a seat from a
  QR scan") finds the seat from `seats.public_token`. A technician reaches this page from the
  Cleaning button on the card it shows; the page itself takes the seat id.

## Seat QR code

Source: PO Decision Log, PRD v1.1 section 20 (QR code rules).

- Each seat has one permanent QR code made from its unique `public_token`.
  The code carries no personal data, no sensitive booking data and no
  internal data.
- **A scan only identifies the seat.** It does not sign anyone in, does not
  replace a booking and never performs an action. Every action after the
  scan needs authentication, a role permission (RBAC) and tenant isolation.
  Signed out, the person signs in first and then returns to the seat (see
  FO-F03-S11 above).
- A partner reaches only seats in its scope. A technician acts only within
  assigned work. RLS decides this, not the page.
- There is no public lookup and no public route for a QR code. A separate
  Digital Passport is outside the MVP.
- Open (PRD section 17): the QR URL format, whether a token can be revoked
  or replaced, and bulk print or export of codes. Until they are decided,
  `public_token` stays immutable (`guard_seat_update()`).

### Show the seat QR code (CO-F04-S12)

- **What the code holds.** The address `<NEXT_PUBLIC_APP_URL>/q/<public_token>` and nothing
  else (`seatQrPayload`): no serial number, id, partner, booking or status (AC02). The token is
  checked before it goes into an address (letters, digits and hyphens, at most 128), so a bad
  value cannot add a path or a query. The image is made on the server by `qrcode-generator`
  (pure JavaScript, no dependency of its own) and holds no text.
- **A permanent address.** A printed code must not depend on the request that made it, so the
  base address is `NEXT_PUBLIC_APP_URL`. It is required in production (a missing or invalid
  value stops the page with an error that names the variable and no value) and falls back to
  `http://localhost:3000` elsewhere. If the public address of the app changes, printed codes
  must be printed again.
- **Same code, always (AC04).** The image is a pure function of the token, and the token is
  immutable (`guard_seat_update()`), so editing the other data of a seat never changes its code.
- **Access.** The code is shown on the seat detail page (`seats:manage`) and downloaded from
  `GET /api/seats/[id]/qr`: no session gives 401, no `seats:manage` gives 403, a malformed id
  gives 400, and an unknown seat or one RLS hides gives the same 404, all in the standardized
  error shape. The download is `private, no-store`. Seeing a code is not access: a scan only
  identifies the seat (see "Seat QR code").
- **Scan page.** The page behind `/q/<token>` is CO-F04-S13 (see "Open a seat from a QR
  scan"). Only SVG is offered (a PNG would need a canvas or another library).

### Open a seat from a QR scan (CO-F04-S13)

- **Where a scan leads.** `/q/[token]`. The page only identifies the seat and performs nothing:
  it imports no action and calls no write (checked in a test). Every action after it is on
  another page that checks authentication, permission and tenant isolation on its own.
- **Signed out (AC02, AC05).** The proxy sends the visitor to `/login?next=/q/<token>` and the
  person returns after signing in (see "Start cleaning from a QR scan"). The page also calls
  `requireAuth()`, so it holds if the proxy is ever bypassed. Nothing is read before the session
  is checked.
- **Which seats a user reaches (AC04).** The seat is looked up by `public_token` with the
  user's own client, so RLS decides: a partner reaches the seats of its own bookings, a
  technician the seats of its own work, an internal role every seat. No service-role client.
- **Forged and foreign tokens.** A token that is malformed (checked with Zod before the query),
  unknown, or of a seat outside the user's scope gives the same "Seat not found" page, so a
  scan does not show whether a seat exists elsewhere.
- **What each role sees (AC06).** An operations role (`seats:manage`) is sent to the full seat
  page. A technician or a partner gets a read-only card: serial number, status, category,
  airport, and the retirement date. A retired or quarantined seat still opens with its status.
  The quarantine reason is shown to staff and not to a partner, as in the partner seat list. The
  card carries no token, price, partner, rental count or booking data.

### Protect QR access (CO-F04-S14)

- **Proven with the real lookup.** The tests in "QR access protection (CO-F04-S14)" call
  `getSeatByPublicToken()`, the lookup of the scan page, with the session of each role against
  the local database. A forged, empty, filter-trick, wildcard, path-like or very long token gives
  `null` and no error to every role and to anon (AC01). The valid token of a seat in another
  tenant gives a result equal (`toStrictEqual`) to the one a forged token gets, so a scan does not
  show that the seat exists (AC02). A technician gets nothing for a seat outside their work.
- **What a seat in scope returns (AC03).** Exactly the columns of `SCANNED_SEAT_SELECT`, no more.
  The rendered card holds no booking number, no price, no email of a user, no partner name and
  not the token. A quarantine reason is shown to staff and not to a partner.
- **The address holds the token.** `/q/[token]` and its not-found page set `robots: noindex,
  nofollow` and `referrer: no-referrer`, so the token is not indexed and does not leave the
  app in a Referer header. The files on the scan path log nothing, the error page prints no
  error, and the lookup never uses the service role (checked in a test).
- **Not covered: guessing at scale.** There is no limit on the number of scans a user makes. A
  token is a random UUID (122 bits), so guessing one is not practical; a rate limit would need
  infrastructure the project does not have. See [known-limitations.md](known-limitations.md).

### QA of the QR and cleaning rules (DL-T4)

Tests in `src/lib/auth/rls.integration.test.ts`, named "QR token lookup (DL-T4)", "a failed
cleaning (DL-T4)", "a booking in the cleaning period blocks the start (FO-F03-S09)" and
"open cleaning jobs of a seat for the QR scan (FO-F03-S11)", "QR access protection (CO-F04-S14)" and
"scan to cleaning chain (DL-T4)". They run against the local
Supabase stack and skip without it.

| Decision Log rule (PRD v1.1 section 20) | Covered by | State |
|---|---|---|
| A forged or unknown token shows nothing | Five forged forms (unknown, empty, filter trick, wildcard, very long) give no row and no error for every role and for anon | Tested at the database |
| A token of another tenant shows nothing, and looks the same as a forged one | Partner A with a token of partner B and the reverse give the same result as a forged token | Tested at the database |
| A scan alone gives no access | Anon and an inactive user get nothing from a valid token | Tested at the database |
| A technician reaches only assigned work | A technician gets nothing for the token of a seat outside their work | Tested at the database |
| A quarantined seat opens with its status | An internal role reads it by token | Tested at the database |
| No personal or booking data in the seat | No column of `seats` is about a partner, customer, price or booking | Tested at the database |
| A booking that holds the seat blocks Start | Nine tests of the cleaning period | Tested |
| Cleaning cannot be done by scanning alone when not signed in or without permission | An anonymous caller and an inactive user are refused `start_cleaning` and `complete_cleaning` even knowing the job id, and nothing changes; a partner is refused (older test) | Tested at the database |
| A scan leads to the cleaning only through the rules of the cleaning | Scan, find the job, Start is refused by a booking in the period (`JB009`) and nothing changes; scan, Start, fail, scan again shows the quarantine (the reason to a technician, not to a partner); a partner of another tenant reaches nothing | Tested at the database, with the real lookups of the pages |
| A failed cleaning does not return the seat to available | Result recorded, seat in quarantine, same job cannot start again, a technician cannot release the seat, an internal role can, the failed record stays | Tested |
| History is never deleted | Completed cleaning, seat history, job events and incident history refuse update and delete | Tested (older tests) |
| The route that reads a code, the redirect, the not-found page and the response body | CO-F04-S13 and S14 | Tested: the real lookup for every role, forged and foreign tokens, the rendered card (see "Protect QR access") |

## Paid days and gross revenue (VI-F04-S04)

- **The rule runs in the database.** A trigger on `bookings` applies the six-day cap when a
  booking becomes `completed`, so no screen, action or future workflow can complete a rental and
  forget it, and nobody can pick the paid days by hand. `paid_days`, `rental_days`,
  `revenue_flag` and `gross_revenue` can only be changed inside the booking functions
  (`guard_booking_update()`, error `55000`), and `paid_days` can never be above 6 (a check).
- **The trigger and the helper hold no authority.** `booking_revenue_terms()` is a pure function
  with an empty `search_path`, not `SECURITY DEFINER`, and takes no user input beyond the booking
  row. Only `authenticated` can run it. The trigger runs with the privileges of the caller and
  reads nothing else.
- **The shares (VI-F04-S05).** The same trigger writes `partner_share` and `platform_share`, from the
  terms in force on the day of the completion, and the id of the version it used
  (`commercial_terms_id`, which cannot be deleted while a booking uses it). The trigger function
  is `SECURITY DEFINER` with an empty `search_path`, because whoever completes a rental may not
  read the terms; it takes only the booking row and cannot be run directly. The table refuses a
  negative amount, one share without the other, and shares that do not add up to the gross
  revenue; money is `numeric(12,2)`, never a float. A completed rental keeps its terms when it is
  calculated again. A partner with no terms in force gets no shares and the flag `no_terms`; it is
  not given the default 30 and 70. A partner user reads only the bookings of its own partner
  (unchanged RLS), so the shares do not leak across partners.
- **The launch credit (VI-F04-S06).** The same trigger gives the launch share while launch terms
  are active and keeps the extra on the booking (`launch_credit`, `launch_credit_balance`), both
  locked like the other finance fields. The balance is the sum over the completed bookings of the
  partner and is read after the trigger has locked the partner row (`for update`), so two rentals
  completed at the same time are calculated one after the other and the credit is not counted
  twice (E4). The lock only slows completions of the same partner and is released when the
  transaction ends. The trigger writes only to the booking being completed and to the version of
  the terms in use (the copy for display). A partner user reads only its own bookings and terms
  (unchanged RLS), so a balance is not visible across partners.
- **Cancelled, no-show and early return (VI-F04-S07).** A trigger prices a booking that becomes
  `cancelled` or `no_show` as not charged, from one function (`booking_case_revenue()`), and
  `revenue_case` keeps the case. It reads no table and writes only the booking it is run for. A
  rental completed after an early return is charged for the time it really lasted. `revenue_case` and
  `actual_return_at` are locked like the other finance fields (`55000`). What a cancellation or a
  no-show is charged is an assumption while spec Q3 is open.
- **A rental with no duration is not charged.** It is flagged (`invalid_duration`), `paid_days`
  is 0 and `gross_revenue` is null until its period is corrected. The way to correct a completed
  booking is not built (the booking edit refuses it); the adjustment stories (VI-F04-S09 to S11)
  come next.
- **Open:** how a started day is counted (every started 24 hours is used) and what an early return
  or a cancellation is charged (spec Q3, VI-F04-S07).

## Commercial terms (VI-F04-S01)

- **Who can do what.** An admin and an operations manager open the Commercial terms screen of a
  partner (`partners:manage`). Only an admin saves (spec Q1, who may edit terms, is still open;
  this is what the existing RLS already allowed). A partner user reads only its own terms (RLS,
  unchanged); a technician has no access. The role is checked in three places: the route, the
  Server Action (`requireRole([])`, admin only) and the database function.
- **Saving adds a version.** `set_partner_commercial_terms()` (`SECURITY DEFINER`, `search_path`
  empty, execute for `authenticated` only, revoked from `anon` and `public`) checks that the
  caller is an active admin itself, takes no user id from the client, validates the shares and
  the date, closes the latest version and inserts the new one in one transaction. Completed
  rentals keep the terms they were calculated with, because a version is never rewritten: a
  trigger refuses a change to the shares, the partner or the start date of a row, for the admin
  and the service role alike, and no role can delete a row (E5, R1).
- **Validation on both sides.** The same Zod schema runs in the form and in the action; the
  database checks the shares again (0 to 100, adding up to 100, launch not below partner) and the
  function checks the date. The error shown to the user is a fixed message per code, never a
  database error.
- **"Today" is the date of the server.** The database and the action use the UTC date, and the
  screen gets it from the server, so a browser in another time zone cannot choose a date the
  database refuses.
- **The other terms (VI-F04-S02).** The launch credit target, the annual fee, the onboarding
  credit, the VAT rate and the payment terms are saved in the same version, with the same checks in
  the form, the Server Action, the function and the table (money from 0 to 9,999,999,999.99 with at
  most 2 decimals, VAT from 0 to 100, payment terms a whole number of days from 0 to 3650). They are
  locked in a version like the shares. Money is financial data: it is not logged and an error shows a
  fixed message. Currency and rounding (spec Q1) and how the VAT is applied (Q2) are open: only the
  numbers are kept and shown, with no currency symbol.
- **The history (VI-F04-S03).** The screen lists the terms that have ended, with the days they
  applied, read only, to an admin and to an operations manager. It reads with the user's own
  client, so RLS decides who sees which partner (a partner user sees only its own, none of another
  partner's), and the list has no action that writes. On every day exactly one version is in force
  (a version runs from its start to its end, both days included, and the next one starts the day
  after), so the terms of a rental for the day it was completed are always one version, and a new
  version applies only from its effective date (E5). `pickCommercialTerms(versions, date)` gives
  that version for any date; this is tested with real rows. Up to 100 versions of a partner are
  read, and a note says when older ones were cut off.
- **Not covered here.** The revenue calculation that reads these terms for a completed rental
  (VI-F04-S05), which will need the same "terms on a date" lookup in the database. The table does
  not keep who saved a version, so the history shows the terms and their dates, not the author.

## Storage

- Supabase Storage buckets are tenant-scoped. Access rules mirror the
  database RLS boundaries — a partner must not be able to read another
  partner's stored files (photos, inspection reports, invoices) via a
  guessed or leaked URL.
- See the F05 section's "Design notes" above for the recommended
  convention (mirror the `partner_id`/role ownership model via
  `storage.objects` policies, reusing F05's helper functions) — no bucket
  exists yet.
