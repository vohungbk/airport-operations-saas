# Backend Rules

Scope: Server Actions, Route Handlers (`src/app/api/**/route.ts`), and any
code that talks to Supabase/Postgres. Extends `docs/architecture.md` and
`docs/security.md` — read those for the reasoning behind RLS and the
service-role-key policy.

## API route conventions

- **Prefer Server Actions** for mutations triggered from the app's own
  UI (forms, buttons). Use a Route Handler only for what a Server Action
  can't do: webhooks, external integrations, non-form mutations, or
  anything a third party needs to call over HTTP — per
  `docs/architecture.md`.
- **Validate all external input with Zod** before it touches any business
  logic or database call — Server Action arguments, Route Handler body/
  query/params. This project standardizes on Zod (already a dependency,
  already used for forms via React Hook Form); **do not add Joi or any
  other validation library** — one validation tool, no exceptions,
  per `CLAUDE.md`'s "do not introduce unnecessary dependencies."
  - Colocate schemas with the feature that owns them
    (`src/features/<domain>/*.schema.ts`) or in `src/lib/validation` for
    genuinely shared shapes.
  - Parse with `.safeParse()` and turn a failure into the standardized
    error response below — never let a raw Zod error reach the client.
- **Standardized JSON error shape** for Route Handlers:

  ```json
  {
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Human-readable summary",
      "details": [{ "field": "seat_id", "issue": "Required" }]
    }
  }
  ```

  - `code` is a stable, machine-readable string (`VALIDATION_ERROR`,
    `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`,
    `INTERNAL_ERROR`, ...) — clients branch on `code`, never on
    `message` text.
  - `details` is optional and only present for structured, field-level
    errors (e.g. Zod validation issues).
  - Pair the shape with the correct HTTP status: 400 validation, 401 no/
    invalid session, 403 authenticated but not permitted, 404 not found,
    409 conflict, 500 unexpected/internal.
  - Successful responses return the resource directly or under a `data`
    key — pick one convention per route family and stay consistent; don't
    mix bare arrays/objects with wrapped ones across routes that belong
    to the same feature.
  - If this shape isn't centralized yet, put it in a small shared helper
    (e.g. `src/lib/api/response.ts`) the first time you touch a Route
    Handler, rather than duplicating the shape ad hoc in every handler.

## Supabase query guidelines

- **Prevent N+1 queries.** Never loop over a result set issuing one query
  per row. Use Supabase's nested `select` to fetch related rows in one
  round trip:

  ```ts
  const { data } = await supabase
    .from("bookings")
    .select("*, seat:seats(*), technician:technicians(*)");
  ```

  If a nested select doesn't fit the shape you need, batch-fetch the
  related rows with a single `IN (...)` query keyed by the parent ids
  instead of one query per parent row.
- **RLS is the tenant boundary, not app code.** Every tenant-scoped table
  has Row Level Security enabled from the moment it's created
  (`docs/security.md`, `F05 — Multi-tenancy + RLS`). A query must be
  correct because RLS allows/denies the row, not because the handler
  added a `WHERE tenant_id = ...` clause as the only safeguard — that
  clause can be forgotten on the next query; RLS can't be.
- **Use the right client for the context**: the server client
  (`src/lib/supabase/server.ts`) in Server Components/Actions/Route
  Handlers; the browser client (`src/lib/supabase/client.ts`) only in
  Client Components. Never import the server client into client code and
  never expose a service-role/secret key to the browser.
- **No service-role client** exists in this codebase yet, and none should
  be added casually — it bypasses RLS entirely. Introducing one requires
  a concrete, reviewed need documented in `docs/security.md`, per the
  existing project policy, not a convenience shortcut for a single query.
- When adding or changing a tenant-scoped table or policy, write/update
  the RLS policy as part of that same change — not as a follow-up task.

## Running SQL or migrations on the cloud database

The user works directly on the linked Supabase cloud project (the app is built
and deployed against it). The Supabase CLI is already logged in and linked.
Local Supabase and Docker are usually not running, so never hand over a
`psql` command, a `$DATABASE_URL` or a SQL Editor guide.

- Give one CLI command, first, in its own bash block, with no long preamble:
  - Migration: `npx supabase db push --linked`
  - Seed or one-off SQL file: `npx supabase db query --remote -f <file>`
- Before handing it over, check with what is read only: `npx supabase db push
  --linked --dry-run` and `npx supabase db query --remote --read-only "<select>"`
  (do the rows, partners and columns the script needs exist?). Say in one line
  what the check showed and what was not run.
- The user runs the write command. Do not run `db push` or a seed on the cloud
  yourself. Say that the target is `production` as the CLI names it.
- A seed file must be safe to run twice (insert only, skip what exists).
