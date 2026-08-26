CLAUDE.md

# Airport Operations SaaS

## Project

A multi-tenant airport operations SaaS for managing child-seat
rental operations.

## Stack

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui
- Supabase
- PostgreSQL

## Architecture

- Next.js App Router
- Server Components by default
- Server Actions / Route Handlers for mutations
- Supabase SSR
- Database-level RLS for tenant isolation

## Important Rules

- Never expose Supabase service-role keys to the client.
- Never rely on frontend filtering for tenant isolation.
- Business logic must not be scattered across React components.
- Use snake_case for database/API fields.
- Do not implement future features unless explicitly requested.
- Do not introduce unnecessary dependencies.
- Always inspect existing code before modifying it.
- Preserve existing architecture.
- Run lint and build after significant changes.

## Feature Roadmap

F01 Project Foundation
F02 Database Foundation
F03 Authentication
F04 RBAC
F05 Multi-tenancy + RLS
...
