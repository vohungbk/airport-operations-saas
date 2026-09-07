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
  - The future public QR seat passport lookup (`F10`) will be added to
    this same public-routes list when it's implemented — it does not
    exist yet and no route for it has been created in F03.
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
  | `operations_manager` | `airports:manage`, `partners:manage`, `seats:manage`, `bookings:manage`, `technicians:manage`, `cleaning:manage`, `inspections:manage`, `incidents:view`, `finance:view`, `dashboards:view` |
  | `technician` | `jobs:view_assigned`, `jobs:update_assigned`, `installation:perform`, `cleaning:create`, `inspections:create`, `incidents:report` |
  | `partner_user` | `bookings:view_own_partner`, `seats:view_own_partner`, `operations:view_own_partner`, `finance:view_own_partner` |

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
| `current_user_partner_id()` | The caller's `partner_id`, or `null` for internal roles and for any inactive/missing-profile `partner_user`. A `null` result makes a `partner_id = current_user_partner_id()` clause return zero rows rather than error or "all rows," turning the partner-isolation design principle above into a database fact. |
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
| `technician_jobs` | admin/operations_manager: all. technician: own jobs. partner_user: jobs on their partner's bookings (via `booking_partner_id()`) | INSERT: admin/operations_manager. UPDATE: admin/operations_manager, or technician limited to their own row (`technician_id = auth.uid()`) | Technician UPDATE stops reassigning `technician_id` to someone else, but does not stop changing `booking_id` — a known, deliberately deferred gap (F14/F15) |
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

- **Public QR seat passport (`F10`)**: RLS operates at row granularity,
  not column granularity — it cannot selectively expose
  `seats.public_token` to `anon` while hiding internal columns on the
  same table/policy. Recommended approach when F10 is actually built:
  keep `seats`' RLS scoped `to authenticated` only (never add an `anon`
  policy to `seats`), and expose a separate `SECURITY DEFINER` RPC or a
  narrow public view that returns only an explicit whitelist of safe
  fields, keyed by `public_token`.
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

## Public QR Passport

- The permanent QR seat passport (`F10`) will have a public-facing lookup.
  That lookup must expose only the minimal, safe public fields (e.g. seat
  category, inspection status) and never partner-internal, financial, or
  personally identifying data.
- See the F05 section's "Design notes" above for the recommended
  RLS-compatible approach (a `SECURITY DEFINER` RPC or narrow public view,
  never an `anon` policy on `seats` itself) — not implemented yet.

## Storage

- Supabase Storage buckets are tenant-scoped. Access rules mirror the
  database RLS boundaries — a partner must not be able to read another
  partner's stored files (photos, inspection reports, invoices) via a
  guessed or leaked URL.
- See the F05 section's "Design notes" above for the recommended
  convention (mirror the `partner_id`/role ownership model via
  `storage.objects` policies, reusing F05's helper functions) — no bucket
  exists yet.
