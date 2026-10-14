# Airport Operations SaaS

A multi-tenant airport operations SaaS for managing child-seat rental
operations at airports. Rental-car partners, airports, seat inventory and
bookings are managed in one place, with tenant isolation enforced by the
database.

## Stack

- Next.js (App Router, Server Components by default) and TypeScript
- Tailwind CSS and shadcn/ui
- Supabase (Auth, PostgreSQL) with database-level Row Level Security
- Zod for input validation
- Vitest for tests

## Getting started

### Prerequisites

- Node.js and npm
- Docker (only to run Supabase locally)

### Setup

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local`. The app checks these variables when the server
starts and stops with a clear configuration error if one is missing or
invalid:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (http or https) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key |

Only `NEXT_PUBLIC_*` values are sent to the browser. Never put a secret or
the service-role key behind that prefix.

### Local Supabase

```bash
npx supabase start       # start the local stack (needs Docker)
npx supabase db reset    # apply migrations and supabase/seed.sql
npx supabase stop
```

`npx supabase start` prints the local API URL and keys to use in
`.env.local`. Studio runs at http://127.0.0.1:54323.

### Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start the development server |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | ESLint |
| `npm run test` | Vitest |

Run `npm run lint`, `npm run test` and `npm run build` before opening a
pull request.

## Project structure

```text
src/app/          Routes (route groups: (auth), (admin), (dashboard), (partner), (technician))
src/features/     Feature modules: actions, components, hooks, lib, schemas
src/components/   Shared UI (ui/ = shadcn/ui, layout/ = app shell and navigation)
src/lib/          Auth, Supabase clients, config, shared helpers
src/config/       Static app configuration (navigation)
supabase/         Migrations and seed data
docs/             Architecture, database, security and roadmap
```

## Documentation

- [Architecture](docs/architecture.md)
- [Database](docs/database.md)
- [Security](docs/security.md)
- [Roadmap](docs/roadmap.md) (feature list and status)
- [Git hooks](docs/git-hooks.md)

## Claude Code harness

- Rules: `.claude/rules/` (git workflow, security, frontend, backend, testing)
- Git hooks: `.githooks/` (installed by `npm install` via `scripts/setup-git-hooks.sh`, see `docs/git-hooks.md`)
- Worktrees: `make worktree-new feat/<name>`, `make worktree-list`, `make worktree-rm feat/<name>`
- One-time setup: `make setup`
