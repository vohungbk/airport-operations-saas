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
  is written to `public.users` keyed on the returned auth user id
  (`src/features/auth/actions/signup.action.ts`). The app never creates
  a `public.users` row before Supabase Auth confirms the auth user
  exists, and the insert is an upsert-by-id so a signup interrupted
  between the two steps (e.g. a dropped request) can safely retry
  without leaving an orphaned or duplicate row.
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
- **`public.users` still has no RLS.** This is the documented exception
  from `F05 — Multi-tenancy + RLS`, unchanged by F03. Any key currently
  used by the app can read/write any row in `public.users`; F03 does not
  attempt to compensate with an application-level `WHERE` filter, since
  that would be both ineffective as a tenant boundary and misleading
  about the actual guarantee.
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
  state," never "unrestricted -> see all partners' data." This is a
  design principle enforced by convention today (demonstrated in the F04
  placeholder `/partner` page); it becomes a real, enforced boundary once
  `F05 — Multi-tenancy + RLS` adds RLS policies keyed on `partner_id`.
- **Route areas**: `(admin)/admin` gated by `dashboards:view`,
  `(technician)/technician` gated by `jobs:view_assigned`,
  `(partner)/partner` gated by `bookings:view_own_partner` — nav
  visibility (`src/config/nav.ts`) and the area's own layout/page guard
  reuse the exact same permission, so there's one source of truth for
  "can this role see this area," not a separate `*:access` permission
  invented for navigation.
- **`getCurrentUser()`'s self-lookup query on `public.users` is safe
  without RLS specifically because it is keyed by the caller's own
  server-verified id** (`auth.uid()` from the validated JWT, never a
  client-supplied id) — the same reasoning F03 already relied on for
  the profile-sync upsert during signup. This is not a precedent for
  querying any other tenant-scoped table without RLS before F05 ships;
  every other table remains off-limits to real user-facing queries until
  then (see the warning at the top of `docs/database.md`).

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

## Storage

- Supabase Storage buckets are tenant-scoped. Access rules mirror the
  database RLS boundaries — a partner must not be able to read another
  partner's stored files (photos, inspection reports, invoices) via a
  guessed or leaked URL.
