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

- `(auth)` — sign-in / sign-up / password-reset routes (unauthenticated)
- `(dashboard)` — the authenticated operations app
- `api` — Route Handlers for cases a Server Action can't cover (webhooks,
  external integrations, non-form mutations)

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
  sessions are refreshed before reaching Server Components.

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
