# Roadmap

Features are implemented incrementally, one at a time. Completing a task
does not imply the next one is started automatically.

```text
F01 Project Foundation
F02 Database Foundation
F03 Authentication
F04 RBAC
F05 Multi-tenancy + RLS
F06 Partner Management
F07 Airport Management
F08 Seat Categories
F09 Seat Inventory
F10 Permanent QR Passport
F11 Booking Management
F12 Booking State Machine
F13 Booking Timeline
F14 Technician Assignment
F15 Technician Mobile Workflow
F16 Cleaning Workflow
F17 Inspection Workflow
F18 Quarantine Workflow
F19 Operations Dashboard
F20 Flight Integration
F21 Partner Portal
F22 Revenue Calculation
F23 Launch Credit
F24 Settlement
F25 Invoice
F26 KPI Dashboard
F27 ROI Dashboard
F28 AI Partner Intelligence
F29 Demo Data
F30 QA + Security Review
F31 Portfolio Polish
```

## Status

- **F01 — Project Foundation**: done. Next.js + TypeScript + Tailwind +
  shadcn/ui scaffold, feature-based folder structure, Supabase client
  architecture, and this documentation set.
- **F02 — Database Foundation**: done. Core Postgres schema (partners,
  airports, seats, bookings, technician/cleaning/inspection tables,
  finance tables) and `public.users`, RLS deferred to F05.
- **F03 — Authentication**: done. Supabase Auth email/password
  login/signup/logout, forgot/reset password, signup profile sync into
  `public.users` (server-hardcoded least-privileged role), and
  server-side route protection in `src/proxy.ts` /
  `src/lib/supabase/proxy.ts`.
- **F04 — RBAC**: done. `user_role` enum finalized to `admin`,
  `operations_manager`, `technician`, `partner_user`; centralized
  permission model and `getCurrentUser`/`requireAuth`/`requireRole`/
  `requirePermission` helpers (`src/lib/auth/`); role-aware nav
  (`src/config/nav.ts`) and shared `AppShell`; 3 protected placeholder
  route areas (`/admin`, `/technician`, `/partner`) plus the shared
  `/forbidden` page. RLS itself is still deferred to F05.
- **F05 — Multi-tenancy + RLS**: done. Row Level Security enabled on all
  18 tables from F02 (`supabase/migrations/20260902085338_enable_rls_multi_tenancy.sql`),
  5 `SECURITY DEFINER` helper functions, a privilege-escalation trigger
  on `public.users`, and no `DELETE` policy on any table. See
  `docs/security.md` for the full per-table rule set.
- **F06 — Partner Management**: done. Internal CRUD for rental-car
  partners at `/partners`, `/partners/new`, `/partners/[id]`,
  `/partners/[id]/edit` (`src/app/(admin)/partners/**`,
  `src/features/partners`): searchable/filterable/sortable/paginated
  list, create/edit forms (`code` immutable after creation), a detail
  page with explicit "not available yet" placeholders for
  booking/inventory data that doesn't exist yet, and soft-only
  deactivation (`status = 'inactive'`, never a hard delete). Gated by
  `requirePermission("partners:manage")` on the route layout, every page,
  and every Server Action. Reuses F05's existing `partners_*` RLS
  policies as-is — no new migration or policy.
- **F07 — Airport Management**: done. Internal CRUD for airport locations
  at `/airports`, `/airports/new`, `/airports/[id]`, `/airports/[id]/edit`
  (`src/app/(admin)/airports/**`, `src/features/airports`): mirrors F06's
  `partners` module 1:1 — searchable/sortable/paginated list (default
  sort `code asc`), create/edit forms (`code` immutable after creation,
  validated as uppercase alphanumeric 2-10 chars), a detail page showing
  real seat/booking/flight related counts (not a placeholder, since those
  tables and their `airport_id` columns already exist from F02). No
  status column and no delete/deactivate action — nothing irreversible in
  this feature's scope. Gated by `requirePermission("airports:manage")`
  on the route layout, every page, and every Server Action. Reuses F05's
  existing `airports_*` RLS policies as-is — no new migration or policy.
