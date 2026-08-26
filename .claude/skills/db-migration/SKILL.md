---
name: db-migration
description: Workflow for safe Supabase/Postgres schema migrations in this project — writing the migration file, enabling RLS in the same change, testing it (and its rollback) against a local database, and regenerating the TypeScript types file afterward. Use when asked to create a migration, add or alter a table/column, add an index or constraint, write an RLS policy, run "supabase migration new", or regenerate/update database types.
---

No schema exists in this repo yet (`docs/database.md`) — this skill
establishes the convention for `F02 — Database Foundation` and every
migration after it. Follow it exactly so the pattern stays consistent as
the schema grows.

## Workflow

1. **Create the migration file.**
   ```bash
   npx supabase migration new <descriptive_name>
   ```
   This creates `supabase/migrations/<timestamp>_<descriptive_name>.sql`.
   Never hand-edit an already-applied/committed migration — write a new
   one instead, even to fix a mistake in a previous one.

2. **Write the forward migration.** Include the table/column/index/
   constraint change **and its RLS policies in the same file** — per
   `.claude/rules/backend.md` and `docs/security.md`, RLS is written as
   part of the change that introduces the table, not a follow-up task.
   Every tenant-scoped table needs `enable row level security` plus
   explicit `select`/`insert`/`update`/`delete` policies scoped to the
   tenant.

3. **Record the rollback.** Supabase's CLI migration runner is
   forward-only (no automatic "down" migration). Put the inverse SQL in a
   comment block at the bottom of the same migration file, so a rollback
   is a known, reviewed action rather than something improvised under
   pressure:
   ```sql
   -- Rollback (run manually against the target database if needed):
   -- drop policy if exists "bookings_tenant_isolation_select" on public.bookings;
   -- drop table if exists public.bookings;
   ```

4. **Test it locally before it ships:**
   ```bash
   npx supabase db reset
   ```
   This replays every migration from scratch against the local Docker
   Postgres instance — it's the fastest way to catch an ordering bug or a
   SQL typo before it reaches a shared environment.

   Then test the rollback path itself: run the commented-out rollback SQL
   against the local instance, confirm the schema returns to its prior
   state, and run `supabase db reset` again to confirm the full migration
   history (including anything after this migration) still applies
   cleanly.

5. **Regenerate the TypeScript types** so application code stays in sync
   with the schema:
   ```bash
   npx supabase gen types typescript --local > src/types/database.types.ts
   ```
   Commit the regenerated `database.types.ts` in the **same commit** as
   the migration — a schema change and its types must never drift apart.

6. **Update dependent code.** Adjust any Zod schema
   (`.claude/skills/api-integration/SKILL.md`) or feature type that
   mirrors the changed columns. Database/API fields stay snake_case
   (`CLAUDE.md`).

7. **Verify**: `npm run lint`, `npx tsc --noEmit` (the regenerated types
   will surface any code that used the old shape), and any RLS
   integration tests for the affected table (`.claude/rules/testing.md`).

## Example

### Input

> "Add a `bookings` table, tenant-scoped, with RLS."

### Output

`supabase/migrations/20260901120000_create_bookings_table.sql`:

```sql
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  seat_id uuid not null references public.seats(id),
  customer_name text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

alter table public.bookings enable row level security;

create policy "bookings_tenant_isolation_select"
  on public.bookings for select
  using (tenant_id = (select auth.jwt() ->> 'tenant_id')::uuid);

create policy "bookings_tenant_isolation_insert"
  on public.bookings for insert
  with check (tenant_id = (select auth.jwt() ->> 'tenant_id')::uuid);

-- Rollback (run manually against the target database if needed):
-- drop policy if exists "bookings_tenant_isolation_insert" on public.bookings;
-- drop policy if exists "bookings_tenant_isolation_select" on public.bookings;
-- drop table if exists public.bookings;
```

Commands run, in order:

```bash
npx supabase db reset
npx supabase gen types typescript --local > src/types/database.types.ts
npm run lint && npx tsc --noEmit
```

Resulting `src/types/database.types.ts` gains a matching entry (excerpt):

```ts
export type Database = {
  public: {
    Tables: {
      bookings: {
        Row: {
          id: string;
          tenant_id: string;
          seat_id: string;
          customer_name: string;
          start_at: string;
          end_at: string;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          seat_id: string;
          customer_name: string;
          start_at: string;
          end_at: string;
          status?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["bookings"]["Insert"]>;
      };
      // ...other tables
    };
  };
};
```
