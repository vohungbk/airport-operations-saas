# Architecture

## Project Purpose

Airport Operations SaaS is a production-style, multi-tenant platform for
managing child-seat rentals across rental-car partners operating at
airports. It coordinates inventory, bookings, technician workflows,
cleaning/inspection, flight timing, and financial settlement between an
operator and its rental-car partners.

This document describes the foundation established for the project. Domain
features are implemented incrementally in later tasks (see `roadmap.md`).

## Tech Stack

- **Frontend**: Next.js (App Router), React, TypeScript, Tailwind CSS,
  shadcn/ui
- **Backend / data**: Supabase (PostgreSQL, Auth, Storage, Row Level
  Security)
- **Validation / forms**: Zod, React Hook Form
- **Data fetching**: Server Components + Server Actions / Route Handlers —
  no client-side global state library

## App Router Architecture

Routes live under `src/app` using Next.js route groups to separate
concerns without affecting the URL structure:

- `(auth)` — sign-in / sign-up / password-reset routes (unauthenticated).
  Since F03: `layout.tsx` (centered auth layout), `login/`, `signup/`,
  `forgot-password/`, `reset-password/` (the last has a server-side
  guard that only renders the reset form when a live session exists —
  otherwise it shows an "invalid/expired link" state).
- `(dashboard)` — the authenticated operations app. Since F03:
  `dashboard/page.tsx` is a minimal landing page used as the real
  post-login/signup redirect target — not the Operations Dashboard
  (`F19`), which comes later. Since F04: `(dashboard)/layout.tsx` calls
  `requireAuth()` and wraps children in `AppShell`; the page itself also
  calls `requireAuth()` as a second, independent guard (same
  layout-guard-plus-page-guard precedent as F03).
- `(admin)`, `(technician)`, `(partner)` — 3 sibling route groups added
  in F04, each protecting one placeholder area (`/admin`, `/technician`,
  `/partner`) behind `requirePermission()` in both the group's
  `layout.tsx` and `page.tsx`. Intended as long-term homes for later
  roadmap features (F06–F09 admin/ops management, F14–F15 technician
  workflow, F21 Partner Portal), not throwaway demo routes. Since F06:
  the `(admin)` group also has its own `partners/` subtree —
  `partners/page.tsx` (list), `partners/new/page.tsx` (create),
  `partners/[id]/page.tsx` (detail), `partners/[id]/edit/page.tsx`
  (edit) — with its own `partners/layout.tsx` guard
  (`requirePermission("partners:manage")`, independent of the sibling
  `admin/layout.tsx`). Route group segments don't contribute to the URL,
  so these resolve to `/partners`, `/partners/new`, `/partners/[id]`,
  `/partners/[id]/edit`, not `/admin/partners*`. Since F07: the `(admin)`
  group also has an `airports/` subtree, mirroring `partners/` 1:1
  (`airports/page.tsx`, `airports/new/page.tsx`, `airports/[id]/page.tsx`,
  `airports/[id]/edit/page.tsx`, `airports/layout.tsx` guarded by
  `requirePermission("airports:manage")`) — resolving to `/airports`,
  `/airports/new`, `/airports/[id]`, `/airports/[id]/edit`.
- `forbidden` — top-level `page.tsx` (outside any route group) rendered
  for both "authenticated but not permitted" and "invalid/missing
  profile." Deliberately does not call `requireAuth()` itself (redirect
  loop risk); see `docs/security.md`.
- `api` — Route Handlers for cases a Server Action can't cover (webhooks,
  external integrations, non-form mutations). Since F03:
  `api/auth/confirm/route.ts` exchanges a signup-confirmation or
  password-recovery email link (`token_hash`/`type` query params) for a
  session — a Route Handler because it's reached via a `GET` link
  clicked from an email, not a form submission.

## Server / Client Component Strategy

Default to Server Components. Data reads happen on the server using the
Supabase server client (`src/lib/supabase/server.ts`), so tenant-scoped
data never has to be fetched and filtered in the browser.

Client Components are used only where interactivity requires it (forms,
modals, controlled inputs). Mutations go through Server Actions or Route
Handlers, validated with Zod before touching the database.

No React Query, Redux, or Zustand — Server Components plus the Next.js
cache/revalidation model cover data fetching without a client-side store.
That decision is revisited only if a concrete feature needs it.

## Feature-Based Organization

`src/features/*` groups code by business domain (`partners`, `airports`,
`seats`, `bookings`, `technicians`, `cleaning`, `inspections`, `finance`,
`flights`, `ai`, `auth`) rather than by technical layer. Each feature owns
its own components, server actions, and types as they're built. Shared,
domain-agnostic code lives in `src/components` and `src/lib`.

`src/features/auth` (F03) follows this shape, one subfolder per concern:

- `schemas/*.schema.ts` — Zod input schemas for login, signup,
  forgot-password, and reset-password. The signup schema intentionally
  excludes `role`/`partner_id`.
- `actions/*.action.ts` — Server Actions wrapping the corresponding
  Supabase Auth call, plus (for signup) the `public.users` profile sync.
- `hooks/use-*-form.ts` — each wraps `react-hook-form` (with a small
  hand-rolled Zod resolver, `src/lib/validation/zod-resolver.ts` — see
  below) and the pending/result state of its Server Action, so the
  `components/*.tsx` files only render.
- `components/*.tsx` — Client Components for the four auth forms plus
  `logout-button.tsx`.

Two small shared modules outside any single feature support this:

- `src/lib/auth/session.ts` — `getAuthUser()` / `requireUser()`, a
  server-only helper for reading the current session's verified JWT
  claims, reusable by any protected Server Component/layout, not just
  auth pages.
- `src/lib/constants/routes.ts` — the single source of truth for
  `PUBLIC_ROUTES`, `AUTH_ONLY_ROUTES`, `LOGIN_ROUTE`, `DASHBOARD_ROUTE`,
  and (since F04) `FORBIDDEN_ROUTE`, consumed by both the proxy-level
  route guard and the auth pages/actions.

### `src/lib/auth/` (F04 additions) and RBAC-related modules

- `src/lib/auth/roles.ts` — `Role`, aliased from
  `Database["public"]["Enums"]["user_role"]` so it can never drift from
  the schema, plus `ROLES` (all 4 values, sourced from the generated
  `Constants.public.Enums.user_role`).
- `src/lib/auth/permissions.ts` — the `Permission` union, `ROLE_PERMISSIONS`,
  and the pure `hasPermission(role, permission)` function. No I/O — the
  single source of truth for "can this role do this," reused by both
  route guards and nav filtering.
- `src/lib/auth/current-user.ts` — `AppUser`, `getCurrentUser()`,
  `requireAuth()`, `requireRole()`, `requirePermission()`. New file,
  separate from `session.ts`, doing the `public.users` round trip that
  `session.ts`'s JWT-only helpers intentionally don't. See
  `docs/security.md` for the full behavior/rationale.
- `src/config/nav.ts` — `NavItem[]` for the protected areas (`NAV_ITEMS` for
  admin and operations manager, `ROLE_MENUS` for technician and partner user)
  and the pure `getVisibleNavItems(role)`, gating each link by the same
  business permission the area's own route guard uses.
- `src/components/layout/app-shell.tsx` — Server Component; computes
  `getVisibleNavItems(user.role)` and renders the shared shell (sidebar +
  content) for every protected route group.
- `src/components/layout/sidebar-nav.tsx` — small `"use client"`
  component; only handles active-link styling via `usePathname()` +
  `cn()`. Receives the already-filtered `NavItem[]` as props — it never
  computes permissions itself.

#### F04 addendum — sidebar icons and the Airport Operations color palette

Cross-cutting UI polish (not its own roadmap `F`-number): `NavItem` in
`src/config/nav.ts` gained an `icon: LucideIcon` field, one per existing
nav item (no new nav items were added). `sidebar-nav.tsx` renders it at
`size-4` next to the label, and the active-link state now reads
`bg-primary/10 text-primary` instead of the old `bg-muted text-foreground`.

Separately, the default shadcn grayscale tokens in `src/app/globals.css`
(`:root` and `.dark`) were replaced with the Airport Operations brand
palette (converted from the given hex values to `oklch(...)` to match
the existing token format), plus new `--success`/`--warning`/`--info`
semantic tokens (and their `-foreground` pairs) registered in
`@theme inline` and consumed by `success`/`warning`/`info` variants on
`badgeVariants` (`src/components/ui/badge.tsx`). `.dark` was updated too,
as inert future-proofing — no toggle/provider activates it yet.

#### CP-F01-S02 — design tokens and shared page states

- **Color tokens only.** All color comes from semantic tokens defined in
  `src/app/globals.css` (`:root` and `.dark`) and registered in
  `@theme inline`. Components use utilities such as `bg-primary`,
  `text-muted-foreground` or `bg-overlay`. Raw hex, `rgb()`, `oklch()`
  and Tailwind palette colors (`bg-red-500`, `bg-black`) are not allowed
  outside `globals.css`; `src/app/design-tokens.test.ts` enforces this.
- **New token:** `--overlay` (modal backdrop), used by `DialogOverlay`.
  `--ring` and `--sidebar-*` now follow the brand palette.
- **Shared page states** live in `src/components/shared`:
  `PageLoading`, `PageEmpty`, `PageSuccess`, `PageForbidden`,
  `PageNotFound` (`page-state.tsx`, Server Components) and `PageError`
  (`page-error.tsx`, client boundary with a retry button). Feature
  `loading.tsx`, `error.tsx`, list empty states, `forbidden/page.tsx`
  and `not-found.tsx` use these instead of hand-written markup.
  `Alert` gained a `success` variant for `PageSuccess`.

### `src/features/partners` (F06)

Follows the same shape as `src/features/auth`, gated end-to-end by
`requirePermission("partners:manage")` (route layout/pages, and again at
the top of every Server Action):

- `types.ts` — `Partner`/`PartnerStatus` aliased from the generated
  Supabase types, `PARTNER_STATUSES` sourced from
  `Constants.public.Enums.partner_status`, mirroring `Role`/`ROLES` in
  `src/lib/auth/roles.ts`.
- `schemas/partner.schema.ts` — `createPartnerSchema`
  (`name`/`code`/`contact_email` required, `status` defaults to
  `'pending'`) and `updatePartnerSchema` (same minus `code` — `code` is
  immutable after creation, never part of the edit schema), plus
  `deactivatePartnerSchema` for the dedicated deactivate action.
  `schemas/partners-query.schema.ts` validates the list page's
  `searchParams` (`q`, `status`, an explicit `sort` column allowlist,
  `order`, `page`/`page_size`), falling back to safe defaults via
  `.catch()` per field instead of failing the page render on a garbled
  URL.
- `lib/build-partners-query-filters.ts` — pure function turning a
  validated query into `{ search, status, sort, order, range }`,
  including backslash-escaping reserved PostgREST `or=`-filter
  characters (`,` `.` `:` `(` `)`) in the search term before it's used in
  `.or("name.ilike...,code.ilike...")`. `lib/get-partners.ts` /
  `lib/get-partner-by-id.ts` are the only server-only Supabase readers —
  RLS (F05) is the tenant/role boundary; these never add their own access
  filter, only search/sort/pagination. Neither joins `bookings`/`seats`
  (out of scope — see `partner-detail.tsx`'s placeholder blocks).
  `lib/partner-errors.ts` maps Postgres errors (`23505` on
  `partners_code_key` → `DUPLICATE_CODE`) to the shared
  `{ code, message }` shape from `backend.md`, never leaking a raw
  Postgres error to the client.
- `actions/*.action.ts` — `create-partner.action.ts`,
  `update-partner.action.ts`, `deactivate-partner.action.ts`. Each
  re-checks `requirePermission("partners:manage")` before touching the
  database. `deactivate-partner.action.ts` is a dedicated action (not a
  generic status update) that only ever sets `status = 'inactive'` for
  one id and returns `CONFLICT` on an already-inactive target instead of
  no-oping — soft-delete only, no `DELETE` anywhere in this feature.
- `hooks/use-create-partner-form.ts` / `use-update-partner-form.ts` +
  `components/create-partner-form.tsx` / `edit-partner-form.tsx` — the
  same `useForm` + `useTransition` + Server Action pattern as
  `src/features/auth`'s forms, sharing field rendering through
  `components/partner-form.tsx` (`mode: "create" | "edit"`; `code` is a
  registered editable input only in `"create"` mode, a disabled
  read-only display in `"edit"` mode).
- `components/partners-table.tsx` / `partners-pagination.tsx` — Server
  Components; sorting/pagination are plain `<Link>` navigation against
  new `searchParams`, no client JS. `components/partners-filters.tsx` is
  the one Client Component the list page needs (search input + status
  `Select`, pushes new `searchParams` via `useRouter`/`usePathname`).
  Both list and detail views render the "active bookings"/"seat
  inventory" columns as an explicit "Not available yet" placeholder,
  never `0` or blank — Booking Management (F11) and Seat Inventory (F09)
  don't exist yet, and no query against `bookings`/`seats` is made here.
- `components/deactivate-partner-button.tsx` — the confirmation `Dialog`
  (shadcn) + `deactivatePartnerAction` call; `router.refresh()` on
  success is what keeps the detail page's status badge from showing a
  stale `'active'` value (no client cache to invalidate otherwise).

### `src/features/airports` (F07)

Mirrors `src/features/partners` (F06) 1:1 as a plain CRUD module —
`airports` has no status column, so there is no deactivate action, no
`AIRPORT_STATUSES`, and no confirmation dialog anywhere in this feature.
Gated end-to-end by `requirePermission("airports:manage")` (route
layout/pages, and again at the top of every Server Action):

- `types.ts` — `Airport` aliased from the generated Supabase types.
- `lib/is-valid-timezone.ts` — pure `isValidIanaTimezone()` backed by
  `Intl.supportedValuesOf("timeZone")`, used by `schemas/airport.schema.ts`'s
  `.refine()` on the `timezone` field.
- `schemas/airport.schema.ts` — `createAirportSchema` (`code`: trimmed +
  uppercased + `/^[A-Z0-9]{2,10}$/`; `name`/`city`/`country`: required;
  `timezone`: required + valid IANA zone) and `updateAirportSchema` (same
  minus `code` — `code` is immutable after creation, never part of the
  edit schema). `schemas/airports-query.schema.ts` validates the list
  page's `searchParams` (`q`, an explicit `sort` column allowlist —
  `code`/`name`/`city`/`country`/`created_at`, default `code asc` —
  `order`, `page`/`page_size`), falling back to safe defaults via
  `.catch()` per field.
- `lib/build-airports-query-filters.ts` — pure function turning a
  validated query into `{ search, sort, order, range }`, with its own
  local copy of the PostgREST `or=`-filter escaping helper (not imported
  from `features/partners` — no cross-feature import). `lib/get-airports.ts`
  / `lib/get-airport-by-id.ts` are the only server-only Supabase readers
  for the airport row itself — RLS (F05) is the tenant/role boundary,
  these never add their own access filter. `lib/get-airport-related-counts.ts`
  runs 3 independent `count: "exact", head: true` queries against
  `seats`/`bookings`/`flights` filtered by `airport_id` for the detail
  page — unlike `partner-detail.tsx`'s placeholder blocks, F07 shows real
  counts by decision (see plan.md's "Quyết định đã chốt" #1), even though
  Seat Inventory (F09)/Booking Management (F11)/Flight Integration (F20)
  haven't shipped their own feature UIs yet. `lib/airport-errors.ts` maps
  Postgres errors (`23505` on `airports_code_key` → `DUPLICATE_CODE`) to
  the shared `{ code, message }` shape from `backend.md`.
- `actions/create-airport.action.ts` / `update-airport.action.ts` — each
  re-checks `requirePermission("airports:manage")` before touching the
  database. No delete/deactivate action exists in this feature.
- `hooks/use-create-airport-form.ts` / `use-update-airport-form.ts` +
  `components/create-airport-form.tsx` / `edit-airport-form.tsx` — the
  same `useForm` + `useTransition` + Server Action pattern as
  `src/features/partners`, sharing field rendering through
  `components/airport-form.tsx` (`mode: "create" | "edit"`; `code` is a
  registered editable input only in `"create"` mode, a disabled
  read-only display in `"edit"` mode; `timezone` is a plain text input).
- `components/airports-table.tsx` / `airports-pagination.tsx` — Server
  Components; sorting/pagination are plain `<Link>` navigation against
  new `searchParams`, no client JS. `components/airports-filters.tsx` is
  the one Client Component the list page needs (search input only — no
  status `Select`, unlike `partners-filters.tsx`).
- `components/airport-detail.tsx` — no delete/deactivate button, no
  status badge; renders the real related-counts cards from
  `getAirportRelatedCounts`.

### `src/features/seats` (F09)

Mirrors `src/features/seat-categories` (F08). Gated end-to-end by
`requirePermission("seats:manage")` (route layout, every page, every
Server Action). Routes: `/seats`, `/seats/new`, `/seats/[id]`,
`/seats/[id]/edit` under `src/app/(admin)/seats/**`.

- `types.ts`, `schemas/seat.schema.ts` (create, `buildUpdateSeatSchema`,
  change-status), `schemas/seats-query.schema.ts` (`q`, `airport_id`,
  `category_id`, `status`, sort allowlist, pagination).
- `lib/build-seats-query-filters.ts` (pure; reuses
  `seat-categories/lib/escape-ilike`), `lib/get-seats.ts` (one nested
  select for category + airport, no N+1; `PGRST103` handled like F08),
  `lib/get-seat-by-id.ts`, `lib/get-seat-status-history.ts` (read-only),
  `lib/get-seat-form-options.ts`, `lib/seat-status.ts` (labels and the
  manual transition table, kept in sync with `change_seat_status()`),
  `lib/seat-errors.ts`.
- `actions/create-seat.action.ts`, `update-seat.action.ts`,
  `change-seat-status.action.ts` (calls the `change_seat_status` RPC; never
  a direct status update). No delete action.
- UI: Server Components for table/pagination/detail/history; client
  components only for filters, forms, and the change-status dialog. Only
  serializable props cross the boundary (status strings, option arrays).
  The status badge always shows an icon plus a text label.
- Id schemas use `z.guid()` because seeded dev ids are not RFC UUID
  variants.

### `src/features/bookings` (F11)

Mirrors `src/features/seats` (F09). Routes under
`src/app/(dashboard)/bookings/**`: `/bookings`, `/bookings/new`,
`/bookings/[id]`, `/bookings/[id]/edit`. Guards: `requireAnyPermission`
(list/detail, so `partner_user` can view) and `requirePermission("bookings:manage")`
(new, edit, all actions).

- `types.ts`, `schemas/booking.schema.ts` (create, update,
  change-status, available-seats), `schemas/bookings-query.schema.ts`.
  Numeric and optional fields stay strings in the schema so the form
  values equal the schema output; `lib/booking-rpc-args.ts` converts them.
- `lib/booking-time.ts` (pure, `Intl` only): wall-clock time at the
  airport <-> UTC. `lib/booking-status.ts` (labels, active statuses, manual
  transitions kept in sync with `change_booking_status()`),
  `lib/booking-errors.ts`.
- `lib/get-bookings.ts` (one nested select for partner, airport, seat,
  category; `PGRST103` handled), `get-booking-by-id.ts`,
  `get-booking-events.ts` (read-only; seat serials resolved with one `in`
  query), `get-booking-form-options.ts`.
- `actions/create-booking`, `update-booking`, `change-booking-status`
  (always via RPC, never a direct write) and `get-available-seats`
  (read-only seat picker data).
- Date filters use the selected airport's timezone (UTC when no airport is
  selected).

## Supabase Architecture

Three integration points, matching the current Supabase SSR guidance for
Next.js App Router:

- `src/lib/supabase/client.ts` — browser client (`createBrowserClient`),
  used from Client Components.
- `src/lib/supabase/server.ts` — server client (`createServerClient`),
  used from Server Components, Server Actions, and Route Handlers. Reads
  cookies via `next/headers`.
- `src/proxy.ts` + `src/lib/supabase/proxy.ts` — request-time session
  refresh. Next.js 16 renamed the `middleware.ts` file convention to
  `proxy.ts`; the exported function is named `proxy` instead of
  `middleware`. The helper (`updateSession`) revalidates the auth token on
  every matched request via `supabase.auth.getClaims()` so expired
  sessions are refreshed before reaching Server Components. Since F03,
  `updateSession` also enforces route protection: an unauthenticated
  request to a route outside `PUBLIC_ROUTES` is redirected to `/login`,
  and an authenticated request to `/login`/`/signup` is redirected to
  `/dashboard`. Any redirect it issues carries the refreshed session
  cookies forward — dropping them would silently break the session right
  after the refresh that produced them. `src/proxy.ts` keeps its
  pre-existing `isSupabaseConfigured` bypass so local dev without
  `.env.local` still works.

No service-role (secret key) client exists yet — it will be introduced
only when a specific feature requires bypassing RLS from trusted server
code (see `security.md`).

## High-Level Domain Boundaries

- **Identity & Access** — auth, roles, tenant membership
- **Partners** — rental-car partner accounts
- **Airports** — airport locations partners operate at
- **Inventory** — child-seat categories and physical seat units
- **Bookings** — rental lifecycle and state machine
- **Technician Operations** — assignment and mobile workflow
- **Cleaning & Inspection** — seat turnaround and quarantine
- **Finance** — settlement, invoicing, revenue calculation
- **Flights** — flight tracking used to time bookings
- **AI** — partner intelligence (later phase)

Each boundary maps to a `src/features/*` folder and, once schema work
starts, to a Postgres schema/table group protected by RLS.

#### UI-F01-S01 — design tokens from the design file

- **One source.** `src/app/globals.css` defines the tokens under the names
  of the design file (frame "Foundations / Exact source tokens"): 36 color
  tokens in `:root` (Light) and `.dark` (Dark), the type scale
  (`text-display` to `text-caption`), the 4px spacing grid and the radius
  steps (4, 8, 12, 16, full). Colors are written as hex, as in the design.
- **Names.** The design name `color/surface-muted` becomes `--surface-muted`
  and the utility `bg-surface-muted`. Status colors come as a trio:
  `success`, `success-bg`, `success-fg` (same for `warning`, `danger`,
  `info`). Charts use `chart-1` to `chart-6` and `chart-grid`.
- **Legacy names stay.** `--card`, `--muted`, `--destructive`, `--ring`,
  `--sidebar-*` and the other shadcn names resolve to a design token, so
  existing components keep working. New code uses the design names.
- **Known gaps.** The ticket asks for 40 color tokens but the design has 36;
  the question is open with the PO. The dark theme is defined but nothing
  switches it on yet. The font is Inter, as in the design (`next/font/google`
  in `src/app/layout.tsx`); the mono font is still Geist Mono.
- **Tests.** `src/app/design-tokens.test.ts` checks names and hex values in
  both themes, the status trios, the chart colors, the legacy aliases, and
  that no raw color appears outside `globals.css`.


#### UI-F01-S02 — guarding token quality

- **Checks run before every build.** `npm run build` first runs the
  `prebuild` script, which runs `src/app/design-tokens.test.ts` and
  `src/lib/accessibility/token-contrast.test.ts` (and, since UI-F01-S05,
  `class-contrast.test.ts`). A raw color outside
  `globals.css`, a missing token or a pair below its ratio stops the build.
  The same tests also run in `npm test` and in the pre-push hook.
- **Contrast.** `src/lib/accessibility/contrast.ts` lists the color pairs the
  application draws and checks them in Light and Dark: 4.5:1 for text, 3:1
  for control borders, the focus ring, status marks and chart colors. The
  test names carry the pair, and `should list every ratio` prints the table.
  A pair that is not in the list is not checked: add a new pair there when a
  component starts to use it. Left out on purpose: `border` and `chart-grid`
  (plain rules), and the `*-foreground` aliases of `success`, `warning` and
  `info` (nothing draws them; `info-foreground` on `info` is 4.1:1 in Light).
- **Raw colors.** `src/lib/accessibility/raw-colors.ts` finds hex, `rgb()`,
  `hsl()`, `oklch()`, Tailwind palette classes and inline style colors in
  source. Token classes, `var(--...)`, `currentColor` and `transparent` pass.
- **Print is always Light.** The `.dark` rule sits in `@media not print`, and
  the `dark:` variant is wrapped the same way, so on paper the Light tokens
  apply whatever theme the user chose. The only printed page today is the
  seat QR card. Invoices and statements have no screen or PDF yet; they get
  the same rule for free when they are built, but it has not been checked on
  them.


#### UI-F01-S03 — switching the theme

- **Control.** `ThemeControl` (`src/components/theme/theme-control.tsx`) is one
  button that switches between Light and Dark. It shows the icon of the theme
  it will switch to: the moon on a light page, the sun on a dark page. Both
  icons are in the markup and the `dark` class shows one of them, so the right
  icon is there from the first paint. Until the first press the theme is
  System (it follows the device); the first press saves an explicit Light or
  Dark on the device. There is no System option in the UI any more, so the
  only way back to System is to clear the `theme` value of the site.
  The button sits in the mobile top bar and next to the user block of the
  desktop sidebar (both in `AppShell`), and in the top-right corner of the
  sign-in pages. Desktop has no top bar yet. It has no role check: every role
  and a signed-out visitor may use it.
- **States.** Loading: disabled until the saved choice is read. Success: the
  theme changes at once and a status line is announced after a press. Error: if
  the choice cannot be written to the device it still applies and the status
  line says it could not be saved. Permission Denied does not apply.
- **Logic is outside the component.** `src/lib/theme/theme.ts` holds the
  choices, the Zod schema and the rules; `theme-store.ts` is the store (reads
  the saved value, sets the `dark` class on `<html>`, follows the device while
  System is chosen, follows other tabs through the `storage` event). Its
  dependencies are passed in, so it is tested in Node. `use-theme.ts` is a thin
  `useSyncExternalStore` wrapper.
- **No wrong first paint.** `theme-script.ts` is an inline script in the
  `<head>` of the root layout, with no `async` or `defer`; it sets the class
  before the first paint. The `<html>` element has `suppressHydrationWarning`
  for that reason. There is no CSP or nonce in the app today; add a nonce to
  the script if one is added.
- **Saved on the device only.** The key is `theme` in `localStorage`; nothing
  goes to the server (spec OOS-1). A missing value means System and nothing is
  written. An invalid value means System and is replaced (see UI-F01-S04).
  `color-scheme` follows the theme so scrollbars and native controls match.
- **No new dependency.** `next-themes` was not added.


#### UI-F01-S04 — remembering the theme

- **Next visit.** The choice is written when the button is pressed and read by
  the script before the first paint of every later page, in the same tab, after
  a reload, and in a new tab. `theme-persistence.test.ts` runs the real script
  and the real store on one fake device storage to show this.
- **Invalid saved value.** The script itself replaces a value that is there but
  is not `light`, `dark` or `system` with `system`, on every page. Before, only
  the store did it, and the store exists only on a page that has the button, so
  a page such as `/forbidden` kept the bad value. A missing value is not
  written.
- **JavaScript off or slow.** With no script the page keeps the `:root` tokens,
  which are Light; the CSS does not read the device setting, because that would
  need the 36 dark tokens twice. While the page loads the button is shown
  disabled with the icon that matches the page, and it works once the page has
  loaded.


#### UI-F01-S05 — the theme on every page

- **Every page uses the tokens, and reads in both themes.** Besides the raw
  color check, `src/lib/accessibility/class-contrast.ts` reads the Tailwind
  classes written in source (`bg-success-bg text-success-fg`) and checks each
  text color against its background at 4.5:1, in Light and in Dark. Text with
  no background class is checked on the page, a card and a popover. A tint such
  as `bg-danger/10` is mixed over the page first. It runs in `prebuild`, so a
  weak pair stops the build.
- **What it cannot see.** A class built at run time from pieces, classes that
  are not colors (`text-sm`), and states such as `hover:`. Check those by eye.
- **What it found.** `text-destructive` (error text, 10 places) was about 4.5:1
  or less in Light and the destructive button was 3.9:1. Both now use the
  `danger-bg` and `danger-fg` pair, which is at least 6.8:1 in both themes.
  `destructive` stays for borders and rings.
- **Where the control is.** `theme-placement.test.ts` lists every page and
  checks a layout above it holds `AppShell` or `ThemeControl`: sign-in pages
  through `(auth)/layout.tsx`, admin, dashboard, partner and technician through
  the shell. The home stub and `/forbidden` have no control on purpose (the
  spec puts it in the top bar, the user menu and the sign-in pages); they follow
  the theme through the tokens. A new route group without the control makes the
  test fail.
- **Signed-out choice.** It is kept in `localStorage`, which sign-in and
  sign-out do not touch. A test fails if any file outside `src/lib/theme` uses
  `localStorage` or `sessionStorage`.


#### UI-F02-S01 — the desktop sidebar

- **Where.** `DesktopSidebar` (`src/components/layout/desktop-sidebar.tsx`) is
  the sidebar from the `md` breakpoint (768 px) up. `AppShell` stays a Server
  Component: it filters the menu by role (`getVisibleNavItems`) and hands the
  list down, as before. Below 768 px the mobile bar and the drawer are
  replaced by the bottom navigation (UI-F02-S03).
- **Menu.** `SidebarNav` marks the current item with a marker on its left
  edge, the active color and `aria-current="page"`. It is a navigation
  landmark labelled "Main navigation". A long label is cut and shows in full in
  a tooltip (UI-F02-S02). Hiding an item is only a look: the server still checks access
  on every page (spec R9).
- **Collapse.** The button at the top of the sidebar switches between 256 px
  and 72 px (`SIDEBAR_WIDTH_CLASS`). Collapsed, only the icons show, each with
  a tooltip (`src/components/ui/tooltip.tsx`, on `@base-ui/react/tooltip`) on
  hover and on keyboard focus, and the name stays for screen readers. The
  account menu and the theme control are in the top bar (UI-F02-S02).
- **Remembered.** The choice is the cookie `sidebar_collapsed` (`1` or `0`,
  path `/`, one year, `SameSite=Lax`), written by `useSidebarCollapsed` and read by
  `AppShell` with `cookies()`. The server draws the page at the right width,
  so nothing jumps on load. A missing or invalid value means expanded. The
  cookie is a look, not a permission, so it holds nothing else.
- **Not in this story.** The Permission Denied state inside the shell (today a
  forbidden page replaces the shell).

#### UI-F02-S02 — the top bar

- **Where.** `TopBar` (`src/components/layout/top-bar.tsx`) is a 44 px bar above
  the content, from the `md` breakpoint (768 px) up, off the printed page.
  `AppShell` puts the top bar and `<main>` in one column next to the sidebar.
  Below 768 px the app bar and the bottom navigation are used (UI-F02-S03).
- **Breadcrumb.** `Breadcrumb` reads the path (`usePathname`) and
  `buildBreadcrumb` (`src/lib/layout/breadcrumb.ts`, pure) turns it into
  crumbs: the area named as in the menu, then `New`, `Edit`, other words as
  words and a record id as `Details`. Nothing is fetched, so no booking number
  or seat name. The last crumb is the current page (`aria-current="page"`); a
  long crumb is cut and keeps its text as the title. The home icon links to
  `/dashboard`, which sends a partner user on to the partner portal.
- **Account menu.** `UserMenu` shows the name, the role (`ROLE_LABELS`, one
  label per value of the `user_role` enum, checked at compile time) and the
  email of the signed-in user, and Sign out through the existing
  `logoutAction`. It decides nothing about access.
- **Theme control.** The theme button moved from the sidebar to the top bar.
- **Counts.** `formatCount` writes `99+` from 100 up and nothing for 0, and
  `CountBadge` shows it. `SidebarNav` takes an optional `count` per item and
  shows the badge while the sidebar is expanded. Nothing sets a count yet,
  because what to count is still an open question (spec Q2).
- **Long labels.** An item whose label is cut in the expanded sidebar shows the
  full label as a tooltip (`useIsTruncated` measures the element); collapsed, the
  tooltip always shows.
- **Not here yet.** The search box (spec Q1: what it finds and for which roles)
  and the notification bell with the flight-alert count (spec Q2). A control
  that does nothing is worse than none, so they are left out until the product
  owner answers.


#### UI-F02-S03 — the mobile navigation

- **Where.** Below 768 px the shell has an app bar on top, the content, and a
  bottom navigation fixed to the bottom (`MobileAppBar`, `BottomNav`,
  `MoreSheet` in `src/components/layout`). The old hamburger drawer
  (`MobileNav`) is gone. All three are hidden from 768 px up and off the
  printed page.
- **Bottom bar.** Five slots, at least 68 px high: up to four items of the role, then
  More. `splitMobileNav` (`src/lib/layout/mobile-nav.ts`, pure) picks the four
  from a priority list per role (`MOBILE_NAV_PRIORITY`) and leaves the rest
  for More. The lists are a proposal for spec question Q3: operations manager
  and admin get Command Centre, Bookings, Jobs, Incidents; technician gets
  Today's Jobs, Incidents; partner user gets Overview, Rentals, Seats,
  Finance. The bar is never filled with an item whose page is not built yet
  (`planned`); it stays in More. The menu given to the function is
  already filtered by role on the server, so the lists grant nothing. Each slot
  has an icon and a label and is at least 44 px high; the current item has a
  bar on top, a heavier label and `aria-current="page"`.
- **More sheet.** A bottom sheet on the shared `Dialog` (focus stays inside,
  Esc closes, focus returns to the More button). It lists the other items, a
  Theme row with the theme control, and the name, role and email of the user
  with Sign out. It closes when an item is chosen or the page changes
  (`useMobileNav`). The technician list holds My History and the partner list
  holds KPI, ROI and Assistant, whose pages are not built yet.
- **App bar.** `buildMobileAppBar` (`src/lib/layout/mobile-title.ts`, pure)
  takes the title from the last crumb of the breadcrumb and adds a Back arrow
  to the crumb above on a page below an area (detail, new, edit), or to the
  dashboard when that crumb has no page. The title is not a heading, because
  the page has its own.
- **Space for the bar.** `main` has 84 px of padding at the bottom below 768 px,
  plus the safe area of the phone, so the end of the content is not under the bar
  (spec R11). UI-F02-S05 adds the
  rest of the layout checks.
- **Not here.** The pages of the design that do not exist yet (History,
  KPI; Scan was added by UI-F07-S02), and a Permission Denied state inside the shell.


#### UI-F02-S04 — the menu per role

- **Menus.** Admin and operations manager have the full menu (`NAV_ITEMS`).
  The technician and the partner user have a shorter one of their own
  (`ROLE_MENUS` in `src/config/nav.ts`): technician, Today's Jobs, My History
  and Incidents; partner user, Overview, Rentals, Seats, Finance, KPI, ROI and
  Assistant (UI-F02-T01). Each item is still filtered by the permission of the
  role on the server (`getVisibleNavItems`). A menu is only a look: the
  pages are guarded on the server (spec R9), and a role can still open a page
  it holds the permission for even when the page is not in its menu.
- **Icons and the current item.** The client looks an icon up by address
  (`getNavIcon`), since a menu item of a role is not always in the full menu.
  `findActiveHref` marks only the item with the longest matching address, so
  `/partner/seats` does not light up Overview as well. The bottom bar of a
  phone follows the role menus (`MOBILE_NAV_PRIORITY`).


#### UI-F02-T01 — the sidebar by role

- **One config.** `src/config/nav.ts` is the only place that says which item a
  role sees: `NAV_ITEMS` (admin and operations manager) and `ROLE_MENUS`
  (technician and partner user). `getVisibleNavItems` filters by permission on
  the server.
- **Figma.** Text, order and icons of the full menu are those of the Figma
  sidebar (file `2qiL4qrfp3rNIOuCxUOFt7`): one flat list, no section labels,
  because the design has none. The technician has no frame in the design; its
  menu follows the ticket.
- **Items without a page.** Return Queue, Flights, Reports, Import, Settings,
  My History, KPI, ROI and Assistant are in the menu because the design has
  them; their pages belong to other features and answer 404 for now
  (`planned: true` in the config). The admin ones use `dashboards:view` until
  their feature adds a permission. The role ones sit under the layout of their
  area, so another role gets 403. The phone bar never takes a `planned` item.
- **Admin menu.** `Technician Jobs` and `Partner Portal` are no longer in it; an
  admin can still open both addresses.
- **403 inside the shell (spec E4).** `requirePermission`,
  `requireAnyPermission` and `requireRole` call `forbidden()` instead of
  redirecting. Next.js answers 403 and renders `forbidden.tsx` of the nearest
  group inside its layout. For that, each group (`(admin)`, `(dashboard)`,
  `(partner)`, `(technician)`) has one layout that checks the sign-in and
  provides the shell, and a `forbidden.tsx` with "Access denied". The layout of
  each area below it only checks the permission. Before, every area had its own
  shell and its own redirect. This needs `experimental.authInterrupts` in
  `next.config.ts`, an experimental option of Next.js.
- **No profile, no partner (spec E1).** A user with no valid profile, no
  partner or an inactive partner still goes to `/forbidden`: no shell, only
  Sign out, and a reason for the partner cases.


#### UI-F02-S05 — keeping the layout safe

- **One breakpoint.** The sidebar and the top bar show from `md` (768 px) up;
  the app bar, the bottom bar and the More sheet show below it. A test checks
  that these use `md` and no other breakpoint.
- **Space for the bottom bar.** `main` keeps 84 px (plus the safe area of the
  phone) of padding at the bottom below 768 px (spec R11).
- **Skip link and landmarks (spec R12).** `SkipLink` ("Skip to content") is the
  first thing a keyboard user reaches and leads to `#main-content`. The shell
  has one `<main id="main-content" tabIndex={-1}>`; the sidebar is a labelled
  `aside`; every `<nav>` has an `aria-label` (a test fails for one without).
  Pages that have no shell (sign-in, `/forbidden`, not found, the error at the
  root, the home stub) get the same skip link and one `<main>` through
  `StandalonePage` (the sign-in layout does it itself). `<main>` is used in
  three places only, and a test lists them.
- **Order and focus (spec R13).** Tab order is: skip link, app bar, sidebar,
  top bar, content, bottom bar (a test checks the order in `AppShell`). The
  items of the shell have a solid outline of 2 px, 2 px away, in the `ring`
  color: 4.1:1 on Light, 8.1:1 on Dark. On the blue bottom bar it is the
  white of the text. The buttons use `SHELL_BUTTON_FOCUS`, because `Button` has
  a half see-through ring and sets `outline-none`.
- **The shell stays on an error or while loading (spec E5).** Each of
  `(admin)`, `(dashboard)`, `(partner)` and `(technician)` has an `error.tsx`
  inside the layout of the group, so a page without a boundary of its own shows
  the error in the content area and not on a bare page. A page with its own
  `error.tsx` and `loading.tsx` keeps them, and the shell is in the layout above
  them, so it stays while they show. A test checks that every page has an error
  boundary at or above it, inside its group. The groups have **no** `loading.tsx`
  on purpose: it would put every guard layout below it in a Suspense boundary, the
  page would start to stream first and `forbidden()` could no longer answer 403.
- **Hiding an item is cosmetic (spec R9).** A test lists every page of the
  admin, partner and technician areas and checks it is behind a guard of the
  server, in the page or in a layout above it. In the dashboard group the QR scan page is
  the one open to any signed-in role, on purpose: it shows only what row-level
  security lets through.
- **Not here.** A "not found" page for a signed-in user is still outside the
  shell (the spec only asks for errors and loading).


#### UI-F03-S01 — buttons, inputs

- **No gallery page.** A page that lists every component was built first and
  dropped on purpose: the components are checked by tests, and the screens use
  them directly.
- **Button.** `loading` puts a spinner before the label, disables the button and
  sets `aria-busy`, so it cannot be pressed twice. A label that is too long wraps
  (`min-h-*`, `max-w-full`, no `nowrap`) and the button stays in its box.
- **Inputs.** `Input` (32 px), `Textarea`, `InputGroup` with `MoneyInput`
  (currency sign in front), `PercentInput` (`%` after) and `SearchInput`
  (magnifier), and `FieldCounter` (`12 / 200`, in the error color past the
  limit, read out politely). A value that is too long for an input is cut with an
  ellipsis and kept whole in the title (never for a password). The sign inside an
  input is decoration (`aria-hidden`); the label says what the number is.
- **Not here.** Choice controls, pickers, overlays, navigation parts, feedback
  and data parts (UI-F03-S02 to S04), and the 44 px hit area on touch screens
  and the audit of the whole library (UI-F03-S05).


#### UI-F03-S05 — keeping the library accessible and safe

- **Touch targets.** On a touch screen (`pointer-coarse:`) every part a finger
  presses is at least 44 px: buttons, inputs, select, combobox, date picker,
  tabs, menu items and calendar days grow, and the checkbox, radio and switch
  get a wider invisible hit area (`after:`), so they look the same. A mouse
  keeps the compact size of the design. `touch-targets.test.ts` checks it.
- **Tokens only, both themes.** A raw color anywhere in `src` fails
  `design-tokens.test.ts`. `status-contrast.test.ts` checks that every status
  variant reaches the text ratio in Light and in Dark.
- **One place.** A screen uses the library, not a native `button`, `input`,
  `select` or `textarea`; a hidden input is allowed. When a screen needs a part
  the library lacks, add the part to `src/components/ui` first, then use it.
  `library-guard.test.ts` enforces this. Screens that already had native
  controls are listed with their count as a baseline: the count may only go
  down, so a new control fails the test. Moving those 14 controls onto the
  library is open work.
- **No gallery.** There is no gallery route or menu item, so `/gallery`
  answers not-found in every build. A test fails if one is added.


#### UI-F04-S05 — keeping the components safe

- **Where.** The domain components in `src/components/domain`. The checks are in
  `src/lib/components/component-guard.ts` and run in
  `component-guard.test.ts`. They read the source text, so they are a floor:
  the server checks of role and row level security stay the real boundary.
- **Real data only (R9).** A part takes its data as props. It must not import a
  feature, the database client, the demo data or the request headers, must not
  call `fetch`, the clock or `Math.random`, and must not write a figure into the
  markup (`{42}`, `12.50`). A time is passed in (`now`, `formatTime`), as the
  flight card does.
- **Icon and text (R12).** A `Badge` or `Alert` with a state variant, and any
  element with a state color (`text-danger-fg`, `bg-success-bg`, ...), must hold
  an icon and text. A variant the check cannot read counts as a state. Neutral
  variants (`outline`, `secondary`, ...) need none. `StatusBadge` is covered by
  `domain-status.test.ts`.
- **Scope (R13).** A shared part holds no form, no server action and no
  `"use server"`. No domain part and no file of the partner area may import a
  module whose path names an internal-only part: `adjustment`,
  `commercial-terms`, `simulator`. The names of labels (`ADJUSTMENT_LABEL`) are
  not looked at, only module paths. Add a word to `INTERNAL_ONLY_MODULE` when
  another staff-only part appears.
- **Not here.** Components under `src/features` are not scanned; some of them
  still format dates themselves. Hiding a part from a partner is not an access
  check: the partner screens guard on the server (`requirePartnerScope`) and
  RLS filters the rows.


#### UI-F05-S01 — the chart library

- **Library (open question Q1 of the spec).** Recharts, pinned at `3.10.1`. It was chosen
  with the shadcn/ui family in mind and for what it brings: tooltips, a legend and keyboard
  support. `react-is` is overridden to the React version (`19.2.8`) in `package.json`, as
  Recharts asks for with React 19. If the PO chooses another library, only
  `src/components/charts` changes (R6).
- **One door.** Only `src/components/charts` imports the library. `chart-guard.test.ts` fails
  when any other file imports Recharts or another chart library. A screen uses the chart
  parts, never the library.
- **The frame.** `ChartFrame` is the shell of every chart: title, text legend, the switch to a
  table of the same numbers (`ChartDataTable`, full numbers), and the states Loading, Error
  with retry, Permission Denied and Empty. A chart whose values are all 0 or all missing is
  Empty, and data with gaps carries a note (R10). A chart that is loading, failed or not
  allowed never shows the data it was given.
- **Size.** `ChartContainer` takes the width of its parent and sets no width of its own, so a
  chart reflows with the screen (R11). Its height is one of three sizes. The real check at
  390 px needs a screen that draws a chart; the tests check the classes.
- **Colors.** A chart is painted with `var(--chart-1)` to `var(--chart-6)` and
  `var(--chart-grid)` only (R8; `src/lib/charts/chart-tokens.ts`). After the sixth series the
  colors start again and the pattern moves on, so neighbouring series differ by more than color
  (R7). `chart-guard.test.ts` checks the paint of every chart part.
- **Not here.** The chart types (bar, stacked, donut, line, KPI, sparkline) are UI-F05-S02 to
  S04, the accessibility checks UI-F05-S05, and replacing the dashboard bars is part of those.
  There is no gallery, so the journey of AC05 cannot be walked on a screen yet.


#### UI-F05-S05 — keeping the charts honest and accessible

- **Where.** `src/components/charts`. The checks are in `src/lib/charts/chart-guard.ts`, run by
  `chart-guard.test.ts`, and the rules are exercised on every kind of chart in
  `chart-honesty.test.ts`. They read the source, so they are a floor.
- **One frame (R10).** A chart element of the library must sit in a `ChartFrame`, so a chart of
  zeros or of nothing says "No data", a gap carries a note, and a chart that is loading, failed or
  not allowed never shows its values: not in the legend, the label, the table or the print table.
  The sparkline is the one exception (a small line inside a KPI tile that holds the numbers as text,
  drawn only when `sparklineReady`); a test keeps that exemption honest.
- **Told apart by more than color (R7).** A chart of several series sets `legend_style` to
  `pattern` (stacked bars, donut), `symbol` (the solid mode of those two, a symbol before each name) or
  `marker` (lines); the guard fails on `color`. It does not read a computed value.
- **Table view (R5, NAV-1).** Every chart has a "View as table" button (a real button, so a keyboard
  reaches and presses it) and a table of the same numbers, whole, with a gap as a dash.
- **Keyboard and screen reader (E5).** Every chart turns on `accessibilityLayer`: Tab reaches the
  drawing and the arrow keys move between its values, which are read out. The drawing is given a
  name (`withChartName`) and sits in `role="group"` whose label lists every value. It used to sit in
  `role="img"`, which made the focusable drawing inside it nameless; this was found by tabbing to it.
- **Error (E4).** The retry button works even when a screen gives no handler: it reads the page again.
  A screen should still pass `on_retry` to refresh only its data.
- **Print (E6).** The Dark values apply outside print only (`@media not print`), so a chart prints in
  the Light theme. On paper the switch and the retry are hidden and the numbers of the chart are
  printed as a table under it, since paper has no tooltip. A test reads `globals.css` for the print
  rule; the print preview itself was not looked at.
- **Not here.** Components outside `src/components/charts`, and a check of a real print preview.


#### UI-F06-S01 — sign-in and system pages

- **The groups.** `src/lib/restyle/screen-groups.ts` lists the screen groups to restyle in the order of the
  plan (R12): sign-in and system pages, reference data, seat detail with QR, bookings, field operations,
  incidents, dashboards. It is data, not a page: a test keeps it true (every file exists, the order is the
  planned one) and a group is done only when all its screens are restyled and every check is done or
  noted (E4). Update it in the story that restyles a group.
- **What was changed.** The sign-in and system pages already used the shell, tokens and base components.
  What was left was the touch size: a link written as plain text was 17 to 20 px high, under the 44 px of
  R10. A link is now a `TextLink` (`src/components/ui/text-link.tsx`): the `link` look of the button, 44 px
  on a touch screen, underlined. The error at the root is centered like the forbidden and not-found pages
  (`PageError` with `centered`); inside a shell it stays an alert at the top of the content.
  `restyle-guard.test.ts` fails when one of these pages writes a link as plain text.
- **Same behavior (R8).** Addresses, words, actions and permissions did not change; a test checks the
  addresses of the links.
- **Design check (R13, E3).** No design frame for these pages was found in the readable part of the design
  file (the Desktop and Mobile pages could not be read), so they are built from the base components and
  noted for design review. The home page (`/`) is still the placeholder of the project start and is not
  in R1.
- **Checked by hand,** in Light and Dark and at 390 px: every link is 44 px high and the page does not scroll
  sideways; the sign-in journey returns to the page that was asked for. No visual snapshot is stored (spec Q2).


#### UI-F06-S02 — reference data

- **Cards on a phone (R10).** `Table` takes `stacked`: below `sm` (640 px) each body row is a card, each
  cell writes the name of its column in front of its value (`data-label` on the cell), and the header shows
  only the columns that sort, as a row of links after "Sort by". From `sm` up it is the table it was. It is
  CSS only; the roles (`table`, `rowgroup`, `row`, `columnheader`, `cell`) are written out because a table
  made of blocks loses its native roles in some browsers. Only the four lists of this story use it
  (partners, airports, seat categories, seats); the tables of later stories use it too (bookings, jobs,
  incidents, partner seats); the rest scroll sideways in their box until their group is restyled.
- **Sorting and links.** `SortableTableHead` is the head of a column that sorts: a link that is 44 px high on
  a touch screen, with `aria-sort`. The View link of a row is a `TextLink`.
- **Seat detail (R3).** `SeatQrCard` makes the code from the seat and draws it with the shared `QrCodeCard`;
  on paper only the code and the serial number are printed (the heading, the note that sign-in is needed and
  the buttons are hidden). `SeatStatusHistory` shows the changes as the shared `SeatHistoryTimeline`, newest
  first. There are **no photos**: the database has only a `photo_path` text column on installation, cleaning
  and inspection records, with no storage or upload, so there is nothing to show yet.
- **Forms.** The textarea, the checkbox and the selects of the seat form, the seat category form and the change
  status dialog are parts of the library (`Textarea`, `Checkbox`, `Select`, through `Controller`), not
  native controls dressed to look like them. A `Select` is given `items` so it shows the label of the
  chosen value, not its id. The baseline of native controls in `library-guard.test.ts` went down by five.
- **The header of a detail page** wraps its buttons below `sm`; the partner page, with three buttons, ran
  past the edge of a 390 px screen.
- **Not here.** The scanned seat page (`/q/[token]`) was not looked at as a technician, so the group
  "Seat detail with QR" is not marked done. Photos need a feature that stores them. No design frame was
  found for these screens, so the check against the design is noted for design review.


#### UI-F06-S03 — bookings

- **List.** Laid out as the design draws it: a 30 px title with the airport filter and the number of bookings
  below it, a "Create booking" button with a plus, 44 px filters (search with a magnifier, the library
  selects, two date fields, "Clear all" once a filter is set), the table in a bordered box with a muted header
  row of small capitals, the booking number in the mono face, and "Showing a–b of N" with Previous and Next.
  `BookingsTable` is a stacked `Table` (cards below 640 px). It has a Flight column: the number of the linked
  flight and how early or late it is (`formatBookingFlight`, from `flights` through one nested select, so
  there is no extra query per row). Airport and Return stay (Return sorts); Category and Seat moved to the
  detail.
- **Detail.** The heading says "Booking detail" with the booking, its partner and its status below it; Edit
  booking is the primary button. Overview, Flight and Timeline are `Tabs`. The Flight tab is the shared
  `FlightStatusCard` (an early or late flight is said at the top, old data says so); a booking with no
  flight says that. The Timeline tab is the shared `Timeline`, in the time zone of the airport. The revenue is
  a page of its own, so it stays a button in the header.
- **Forms.** The seat, partner, airport and category selects, the notes, and the reason of the status
  dialog and of the adjustment form are library parts (`Select` through `Controller`, `Textarea`). The
  baseline of native controls went down by five. The seat select keeps its "No seat" choice, so a seat can
  still be taken off a booking. The two filter selects are given `items`, so they show "All airports" and
  "All statuses" rather than the value `all`.
- **Not built.** The Workflow step column and the Photos tab (nothing stores them), and the flight update
  history (there is only the flight as it is now, no table of its changes). There is no frame for the
  booking form. The revenue and adjustment pages are not part of R4. The differences from the design that are
  left are noted for design review in `screen-groups.ts`.


#### UI-F06-S04 — field operations, incidents and dashboards

- **Lists.** Jobs, incidents and the partner seats list follow the bookings list: a 30 px title with a line
  below it, a primary button with a plus, 44 px filters (search with a magnifier that submits on Enter, the
  library selects, "Clear all" once a filter is set), a stacked `Table` in a bordered box with a muted header
  row, the whole row opening the record through a link stretched over it, and "Showing a-b of N" with
  Previous and Next. Cards below 640 px.
- **Details and forms.** The job and incident details are a heading with its badges below it, the actions at
  the right, and a `Card` for each group; their history is the shared `Timeline`. The installation, cleaning
  and inspection pages and the report form are a `Card` with `Textarea` and buttons of 44 px. The two status
  dialogs use `Select` through `Controller` and `Textarea`; the baseline of native controls went down.
  The report form keeps native selects for the job and the severity, at 44 px (they are registered with the
  form).
- **Dashboards.** The Command Centre (`CommandCentre`) and the Partner Overview (`PartnerOverview`) are the
  frame of the design and nothing else: the count cards of the earlier dashboard and the partner home cards are
  no longer on the pages (their components stay in the code, unused). `OverviewTile` is the tile; a figure whose
  formula is not built is a dash. The charts are the library parts (`DonutChart`, `HorizontalBarChart`,
  `StackedBarChart`) through `StatusChart` and `StockByCategory` (UI-F06-S05 replaced the hand-drawn cards of
  UI-F06-S04, so the Command Centre has no chart of its own; `chart-cards.tsx` is gone). A group that could not be
  read shows the chart error with a retry, and one with nothing to count shows the chart's empty state, both from
  `ChartFrame`. The ring and the stacked bar use the `solid` mode of `DonutChart` and
  `StackedBarChart` (UI-F06-S05): each series is a solid chart token, and the legend puts a symbol before each
  name (`legend_style="symbol"`), as the design frame does. The symbol is the second cue of R7, so a series is
  still not told by color alone. Without `solid` the charts keep their patterns. New reads: `getFlightAlerts` (early and late flights, for the banners), `getStockByCategory`
  (seats of each category in one nested select) and `getUpcomingPartnerRentals`. Each catches its own failure and
  gives no banner or `null`. The partner seats list is a stacked table.
- **Not built.** The job deadline and number, incident photos, the Return queue, the technician job list, the
  Export report button, and the figures whose formulas are another ticket (the tiles, the revenue rows, the launch
  credit, the queues of Operational attention). Each is noted in `screen-groups.ts`. The design frames for the
  field and incident screens are text wireframes.


#### UI-F07-S01 — Today's Jobs on a phone

- **Page.** `/technician` is Today's Jobs, built from the frame `Today's Jobs · Technician` of the design (read with
  `get_design_context`): a heading with a line under it (the technician, the date, the airport code and the count of
  jobs), the priority banner when a flight arrives early, a card for the first job, the card of its flight, the
  button `Open installation job` (to `/jobs/[id]/installation`) and the card `Next jobs` (a record for each other
  job, opening `/jobs/[id]`). The page checks `jobs:view_assigned` on the server; RLS scopes the rows to the
  technician's own jobs. `loading.tsx` is the Loading state, the group's `error.tsx` the Error state and
  `forbidden.tsx` Permission Denied. A failed read throws, so the page shows the error and never an empty list.
- **Order and "today".** A job has no deadline column, so the list is ordered by the pickup time of the booking.
  "Today" is the UTC day (as on the dashboard). A job of an earlier day that is not done stays on top, and a job in
  progress stays whatever its pickup. Completed and cancelled jobs are not listed. The logic is in `todays-jobs.ts`
  (pure); the read is `getTodaysJobs` (one nested select, explicit columns: no price, revenue share, partner or
  booking notes). Times are written in the zone of the airport (`job-time.ts`; `GST` for Asia/Dubai).
- **A dash.** The job number, the partner, the deadline, the installation deadline and the line under the banner
  (`Complete - before -`) have no source yet: there is no job number column, the partner is not readable by a
  technician (RLS), and there is no formula for the deadline. They are a dash until each has one, and no value is
  made up.
- **Empty.** The frame has no empty state. The spec (E3) gives "No jobs today." with the time of the next open job
  when there is one.
- **Not here.** The scanner, the step screens, the success and next-job screen, the poor-network banner and the
  other stories of UI-F07; the end-to-end journey of AC05 needs them. The bottom navigation of the frame (Jobs,
  History, Scan, Incidents, More) is not changed: the app keeps its menu of the role, and Scan has no page yet.


#### UI-F07-S02 — scan the seat QR on a phone

- **Where.** `/jobs/[id]/scan` (the dashboard group, with the other pages of a job). The job screen has a
  `Scan assigned seat` button for the assigned technician of an active installation job (`getSeatScanHref`, the
  same rule as "Record work"). The page checks the installation permissions on the server and reads the job
  through RLS: a job that is not the technician's is the forbidden state, a job that is not an installation is
  not found. It is built from the frames `Scan seat QR`, `Seat verified · Match` and `Seat verification ·
  Mismatch` of the design.
- **Camera.** `useSeatScanner` opens the back camera and reads QR codes with the browser's `BarcodeDetector`,
  which adds no dependency. Chrome on Android has it; Safari on an iPhone does not, so there the technician types
  the code (spec R9). A denied or missing camera, or a browser that cannot read a QR code, opens the typing form
  by itself. The torch button shows only when the phone says it has a torch. The camera stops when a result is
  shown and when the screen is left. The typing form (a field and `Check seat`) and the line "The camera is not
  available" are not drawn in the design; the spec asks for the fallback.
- **The check.** `verifySeatScanAction` (Zod: the job id and a code of at most 200 characters) reads the job, reads
  the seat the code names and compares it with the seat of the booking. It **only reads**: no row is written, and
  recording the installation still checks the job, the seat and the technician (spec R8). The code is the address
  a seat QR code holds (`/q/<public token>`), the bare token, or a typed serial number (the exact text first, then the same text in another case when that names one seat).
- **RLS limits what a mismatch can say.** A technician reads only the seats of their own jobs
  (`seats_select_technician`). A code of any other seat reads nothing, so the mismatch screen has no serial
  (for a scan) or only the typed serial, no category, and no "Reserved for another booking". That badge shows
  only for a seat the technician can read whose status is reserved. Showing more needs a function that
  returns a scanned seat's serial, category and status to a technician: a change of access that is not made
  here.
- **Last cleaning and inspection** of a matching seat come from `cleaning_records` and `inspection_records`
  (`getSeatLastChecks`); a check that was never made, or could not be read, is a dash, never a pass.
- **Dashes.** The job number in the line under the heading is a dash (no job number column), as on Today's Jobs.
- **The Scan item of the menu.** The technician menu has the Scan item of the design, between My History and
  Incidents, in the bottom bar. A scan is made for a job, so `/technician/scan` sends the technician to the scan
  of the first installation job of the day (`pickJobToScan`), and says "No job to scan." when there is none; that
  line is not in the design.
- **Not here.** The checklist (`Continue to checklist` goes to the existing installation form until the story of
  the step screens), the History item (its page is not built), the "Readiness gate" banner and the rest of the `Job information` frame, the poor-network
  banner, and a check on a real phone.


#### UI-F07-S03 — run steps one task at a time

- **The bar of the main action (spec R3, R7).** `StepActionBar` holds the one main action of a step and the way
  out (Cancel). On a phone it is `fixed` above the bottom navigation (`bottom-[calc(4.25rem+env(safe-area-inset-bottom))]`)
  and the content above it scrolls (the form has `pb-24`); from 768 px up it sits in the flow below the content.
  It is `fixed`, not `sticky`, because the `Card` around a form clips with `overflow-hidden`. The installation form,
  the start and the completion of a cleaning and the inspection form use it, and a test reads their source for it.
- **The success screen (spec R4, NAV-3).** `/jobs/[id]/done?step=installation|cleaning|inspection` is where these
  steps end: the installation, a completed cleaning, and an inspection that did not fail (a failed inspection
  still goes to the inspection page, which shows the quarantine and the bookings it affects). The page does not
  trust the address for the fact that a step is done: `getStepDone` reads the record of the step through RLS, and
  with none (the step is not done, or the job is not the user's) the user goes to the job screen. `step` is
  checked with Zod.
- **The next job.** For a technician the main action is `Next job` (the first job of the day that is not this one,
  `pickNextJob`, to its job screen) and, with none left, `Back to Today's Jobs`. A manager gets `Back to jobs`. A
  failed read of the day's jobs keeps the success screen and offers the way back.
- **From the design.** The frame `Installation success` has the button `Back to Today's Jobs` and no `Next job`; the
  spec has both, and this follows the spec with the frame's button as the fallback. Its banner and its handover
  card (Family Ready, the vehicle location, the deadline, the note to the partner) have no source in the app, so
  they are not written: the banner says `Installation completed` (the text of the next frame) with the booking and
  the time, and the card has the seat and who completed it. The titles for a cleaning and an inspection are not in
  the design.
- **Not here.** The checklist, photos, vehicle bay, completion confirmation and Mark Family Ready screens of the
  design: they need data and storage that do not exist (checks that are saved, photo storage, a Family Ready status).


#### UI-F07-S04 — handle a poor network in the field

- **A failed save keeps the screen (AC01, AC02).** `runJobAction` already turns a failed call into
  `NETWORK_ERROR`, and the forms stay mounted with what was entered. `JobActionErrorAlert` now takes `onRetry`
  and shows a `Retry` button for that error only; the four step screens pass it (the forms submit again with the
  same values, the cleaning start presses start again). A job that was reassigned (`NOT_FOUND`), a lost
  permission (`FORBIDDEN`) and a conflict have no Retry. The actions are single database calls, so a failed one
  leaves nothing half saved.
- **Connection lost in a step (AC03).** `OfflineBanner` (`useOnlineStatus`, the browser's `online`/`offline`
  events through `useSyncExternalStore`) is shown at the top of each step screen while the phone says it is
  offline. The browser can be wrong about being online, so a failed save is still the source of truth.
- **Back from the background (AC04).** `useStepDraft` keeps the text fields of a step (installation: time and
  notes; cleaning and inspection: result and notes) in `sessionStorage` under `step-draft:<step>:<job id>` and
  puts them back when the page loads again. The draft is dropped by Cancel and on the success screen
  (`ClearStepDraft`). Storage access is guarded: when it is blocked the form works without a draft. A failed
  inspection goes to the inspection page, not the success screen, so its draft stays until the tab closes.
- **Reassigned while open (AC05).** Unchanged: the next action is rejected with `NOT_FOUND` and the alert points
  back to the jobs.
- **Not here.** No offline queue and no automatic send when the connection is back (the spec asks for Retry). A
  Retry after a response that was lost on the way can meet the record it already saved, and then the existing
  conflict message is shown. The design has no frame for the banner (node `8:378` is a text label), so it uses
  the destructive `Alert`.


#### UI-F07-S05 — keep field screens usable outdoors

- **Touch targets (AC01, spec R6).** The shared parts already give 44 px on a touch screen
  (`pointer-coarse`, UI-F03-S05); the buttons of the field screens set `min-h-11`. What was left: the radios of
  the cleaning result and the inspection result were native 13 px circles in 20 px rows. Each choice is now a
  row of `min-h-11` with a `size-5` radio. `Badge` (job status, flight status, "Reserved for another booking")
  was 12 px text in a 20 px pill; on a touch screen it is 14 px text in a 24 px pill (`pointer-coarse:`), and
  the same for a mouse as before.
- **Text size.** `field-screens.test.ts` reads the source of the field screens and fails on `text-xs`,
  `text-caption` or a bracket size under 14 px, and on a button without `min-h-11`.
- **Exception: the bottom navigation.** Its labels are 11 px (`text-caption`), as in the design frames. At 14 px a
  label such as "Today's Jobs" or "My History" would take two lines in a slot of a 375 px phone and break the
  height of the bar in the design. The slot itself is 44 px or more. Decide with the design before changing it.
- **Contrast (AC02, spec R11).** Not changed. `token-contrast.test.ts` and `class-contrast.test.ts` hold every
  text pair, the primary button pair included, to 4.5:1 in the Light and the Dark theme, and the Theme control
  is in the More sheet on a phone (`app-shell.test.ts`).
- **Thumb zone (AC03, spec R7).** Done in UI-F07-S03: `StepActionBar` is fixed above the bottom navigation on a
  phone and the content above it scrolls.
- **Not checked.** A real phone in the sun, browser text size and zoom to 200 %. The design has no frame for this
  story (node `8:378` is a text label).

## Invoice list (VI-F09-S01)

- **Route.** `/invoices` (list) and `/invoices/[id]` (a summary of one invoice), in the `(dashboard)` group.
  An admin, an operations manager and a partner user open them (`finance:view` or `finance:view_own_partner`),
  checked in the page; a technician gets the 403 of the route (`forbidden.tsx`, the banner of the design). The
  menu has an "Invoices" item for those three roles, next to "Finance".
- **Scope is RLS.** A partner user is given only the invoices of its own partner by the database. The address
  has no way to name a partner for it: `partner_id` is dropped for a partner user. An operations user may
  filter by partner. A partner is shown only issued, paid and overdue invoices; draft and void are for the
  operations team (a filter in the read, as for the partner finance screen: RLS still lets a partner read
  them, which is a separate ticket).
- **Reads.** `getInvoices()` takes a query that Zod has already cleaned (`invoices-query.schema.ts`: search,
  status, from and to month, partner, sort column from an allowlist, page, page size 10, 25 or 50). The period
  of an invoice is the month of its settlement, filtered with an inner join only when a period is asked for;
  sorting by "Period" sorts by the issue date, because an invoice has no period column.
- **Overdue.** "Overdue by N days" is shown for an invoice whose stored status is overdue; nothing here sets
  that status from the due date.
- **Export CSV (VI-F09-S02).** `GET /api/invoices/export` downloads the list as CSV. It takes the filters and
  the sort of the list from the address and ignores the page: the file holds every invoice they match, read in
  batches of 1000 with the same filter code as the list (`filteredRequest` in `get-invoices.ts`). Signed-in,
  a finance permission and an active partner are checked first (401, 403); RLS is the scope, and a partner is
  given only issued, paid and overdue invoices of its own partner. More than 10,000 invoices is refused with a
  400 that asks to narrow the filters, never cut. The file is machine-readable: the month as `YYYY-MM`, dates as
  `YYYY-MM-DD`, the amount as a plain number; the Partner column is for the operations team. A text cell that
  starts with `=`, `+`, `-`, `@`, a tab or a carriage return gets a leading `'` so a spreadsheet does not run it.
  The file starts with a UTF-8 mark so Excel keeps accents, and has CRLF line ends.
- **Invoice detail (VI-F09-S03).** `/invoices/[id]` shows the number and the status, who, which month and when, three
  cards (amount, due date with its payment terms, VAT with its rate), the lines with the subtotal, the VAT and the
  total, a sentence on how the total is made up, and where the invoice is on Draft, Issued, Paid (overdue and void
  are side states). The lines are the rows of `invoice_lines` (a description and a signed amount; a flag says
  whether the amount is a part of the subtotal). The sentence is written only when those parts add up to the
  stored subtotal. Nothing is calculated again except the VAT rate and the payment terms, which are read off the
  stored figures. Nothing in the app writes lines yet: the story that generates an invoice will.
- **Invoice PDF (VI-F09-S04).** `GET /api/invoices/[id]/pdf` builds the PDF of an invoice on demand from the stored
  invoice, its lines and its settlement (`pdf-lib`, standard fonts; `invoices.pdf_path` is not used, nothing is
  stored). The layout is the document of the design (F9): the title, two lines that wait for the legal details of
  the company (spec Q2, labelled Placeholder), the number, who is billed, the month and the dates, the lines with the
  subtotal, the VAT and the total, and how the total is made up. It is drawn from the same view as the invoice
  detail (`buildInvoiceDetail`), so the document and the screen cannot disagree. The standard fonts hold the
  Western European characters only; another character is written as `?`. Sign-in, a finance permission and an active
  partner are checked (401, 403); RLS is the scope and an unknown, malformed or hidden invoice is the same 404; a
  failure is the standardized error body (500). The Download PDF button (detail) and the "Download PDF" item of the
  row menu ask the route, save the file, and on a failure show the message with Retry; nothing is written.
- **Booking statement (VI-F09-S05).** `GET /api/invoices/[id]/statement` downloads the bookings of an invoice as CSV
  (spec Q3, PDF or CSV, is open; CSV is the assumption: it streams and needs no new dependency). The bookings are the
  ones the settlement of the invoice counted: completed rentals of the partner with revenue (standard or early
  return), in the month of the day they were really returned, or were due when there is no return time (UTC). The
  columns are the booking number, the day returned, the case, the paid days, the gross revenue, the two shares, the
  launch credit and the adjustments (the gross revenue is already net of them). Adjustments carried from an earlier
  month are not listed (assumption). The bookings are read in batches of 1000 after the last booking number
  (`statementBookingBatches`) and streamed, so a long statement has no limit and is never held whole. The first batch
  is read before the answer starts, so a failure there is the standardized 500; a failure later ends the download. An
  invoice with no settlement or no booking gives the header alone. Sign-in, a finance permission and an active partner
  are checked (401, 403); RLS is the scope and an unknown, malformed or hidden invoice is the same 404. The Download
  statement button (detail) and the row menu item ask the route, save the file, and on a failure show the message with
  Retry. Nothing is written and there is no migration.
- **Generate invoice (VI-F09-S06).** `/invoices/new` (an admin only, `requireRole(["admin"])` in the page and the Server
  Action; anyone else gets the 403 of the invoices) makes a draft invoice from an approved settlement. The invoice list
  has a Generate invoice button for an admin. The screen is the card of design F12: a partner, a period (a select and the
  list "Available settlement periods": the month of an approved settlement is selectable, any other is disabled), the
  amount the invoice will be worth (read only), a box that says this only makes a draft, Generate draft and Cancel. Its
  states are the frames of the design: Validation error (client, same Zod schema), Submitting ("Generating..."), Server
  error (Retry), Duplicate invoice (the button is off; a "View invoice" link to the first one, added for the ticket, not
  in the frame), Settlement not approved, and Success (Draft generated, View new draft opens the detail). The months are
  the newest 12 settlements of the partner, read with the user's client together with the invoice made from each
  (`getInvoiceablePeriods`); the amount shown is `invoiceAmounts()`, the same sum as the database.
  `generate_invoice(partner, month)` (migration `20261116090000`) is `SECURITY DEFINER` and checks an active admin
  itself (42501). The settlement row is locked, so two calls at once make one invoice, and a partial unique index on
  `invoices(settlement_id)` where the status is not void is the second wall. It refuses a month with no approved
  settlement (IN002) and a settlement that has an invoice (IN003; the id of that invoice is in the DETAIL, so the screen
  can show it). It writes the draft and its lines in one transaction: gross revenue and partner share (shown only), platform
  share and fees (the subtotal; fees only above zero), VAT 5 percent of the subtotal rounded to the cent, issued on the
  first day after the month and due 30 days later (assumptions: the spec gives no rate; both are the design's figures).
  The number is `INV-YYYY-NNNNNN`, the year of the issue date, counting from 000001 again each year (spec Q5): the highest
  number of the year plus one, taken under a lock for the year. The number is unique and an invoice is never deleted (a
  trigger refuses it for the app roles; a wrong one is voided), so a number is never used twice. A partner is shown only
  issued, paid and overdue invoices, so a draft is not seen by it. Finance history records the invoice and who made it.
  No new table and no new policy; `invoice_lines` still has no insert policy, so the function is the only writer.
  Errors are the stable codes of `backend.md` (a settlement that is not approved is `SETTLEMENT_NOT_APPROVED`, a
  duplicate is `CONFLICT`); a raw database error never reaches the screen. The operations manager is not given the
  button, although the design says "also permitted; issue role to be confirmed": the ticket and the policy are admin
  only, so only an admin has the button. A settlement whose platform share plus fees is zero or negative (for example
  one made of adjustments carried from earlier months) still makes a draft with that figure; whether it should be
  refused is open.
- **Left out of the design on purpose.** Issuing the draft (the Issue invoice button and its confirmation of F12, a step
  that moves a draft to issued), the invoice PDF preview page and its zoom, the update of the
  payment status, Void, Recent activity and View full history of the invoice detail (other tickets). The breadcrumb is the one the shell builds from the menu
  ("Invoices"), not "Finance > Invoices > Invoice list".
