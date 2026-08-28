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
  workflow, F21 Partner Portal), not throwaway demo routes.
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
- `src/config/nav.ts` — `NavItem[]` for the 3 protected areas and the
  pure `getVisibleNavItems(role)`, gating each link by the same business
  permission the area's own route guard uses.
- `src/components/layout/app-shell.tsx` — Server Component; computes
  `getVisibleNavItems(user.role)` and renders the shared shell (sidebar +
  content) for every protected route group.
- `src/components/layout/sidebar-nav.tsx` — small `"use client"`
  component; only handles active-link styling via `usePathname()` +
  `cn()`. Receives the already-filtered `NavItem[]` as props — it never
  computes permissions itself.

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
