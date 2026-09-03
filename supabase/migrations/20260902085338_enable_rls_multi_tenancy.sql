-- F05: Multi-tenancy + RLS. Enables Row Level Security and adds policies
-- across all 18 tables created by F02 (plus the F04 user_role redefine).
-- One migration for the whole feature (not one-per-table) per plan.md
-- Task 2 — this migration only adds to existing tables, it does not
-- create any, so the usual bisectability argument for one-migration-per-
-- table does not apply here.
--
-- Tenant model: partners is the tenant; membership is users.partner_id
-- (nullable for admin/operations_manager/technician, who are internal,
-- not tenant-scoped). See docs/security.md's F05 section for the full
-- policy-by-table reference.

-- =============================================================================
-- Task 3: SECURITY DEFINER helper functions
-- =============================================================================
-- All `stable`, `security definer`, `set search_path = ''` (every inner
-- reference is fully schema-qualified). Owned by the migration-running
-- role, which is what lets them read public.users from inside policies
-- defined on public.users itself without RLS recursion (see the risk
-- note in plan.md — do not `force row level security` on public.users).
-- `EXECUTE` is revoked from `public` and re-granted only to
-- `authenticated`, since Postgres grants EXECUTE to PUBLIC by default on
-- function creation. This Supabase project's `public` schema also carries
-- its own `ALTER DEFAULT PRIVILEGES` granting EXECUTE directly to `anon`/
-- `authenticated`/`service_role` on every new function (independent of
-- the `PUBLIC` pseudo-role) — verified locally via `pg_default_acl` — so
-- each function below also gets an explicit `revoke ... from anon` or
-- the default grant would silently survive the `revoke ... from public`.

create function public.current_user_role()
returns public.user_role
language sql
security definer
stable
set search_path = ''
as $$
  select role
  from public.users
  where id = auth.uid()
    and is_active = true
  limit 1;
$$;

revoke execute on function public.current_user_role() from public;
revoke execute on function public.current_user_role() from anon;
grant execute on function public.current_user_role() to authenticated;

comment on function public.current_user_role() is
  'Returns the callers role from public.users, or null when there is no session, the profile row is missing, or the account is inactive. SECURITY DEFINER so it can read public.users from inside policies defined on that same table without RLS recursion. Reused by most other policies in this migration.';

create function public.current_user_partner_id()
returns uuid
language sql
security definer
stable
set search_path = ''
as $$
  select partner_id
  from public.users
  where id = auth.uid()
    and is_active = true
  limit 1;
$$;

revoke execute on function public.current_user_partner_id() from public;
revoke execute on function public.current_user_partner_id() from anon;
grant execute on function public.current_user_partner_id() to authenticated;

comment on function public.current_user_partner_id() is
  'Returns the callers partner_id, or null for internal roles (admin/operations_manager/technician) and for any inactive or missing-profile partner_user. Because a comparison against null is never true in SQL, a partner-scoped USING clause built on this function returns zero rows (not an error, not all rows) for a caller with no partner assigned yet, making "no partner -> safe empty state" a database-enforced fact rather than a convention.';

create function public.is_internal_user()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select public.current_user_role() in ('admin', 'operations_manager', 'technician');
$$;

revoke execute on function public.is_internal_user() from public;
revoke execute on function public.is_internal_user() from anon;
grant execute on function public.is_internal_user() to authenticated;

comment on function public.is_internal_user() is
  'True for the three internal (non-partner) roles: admin, operations_manager, technician. Centralizes the "is this an internal privileged user" check called out explicitly by the F05 ticket.';

create function public.is_admin_or_ops_manager()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select public.current_user_role() in ('admin', 'operations_manager');
$$;

revoke execute on function public.is_admin_or_ops_manager() from public;
revoke execute on function public.is_admin_or_ops_manager() from anon;
grant execute on function public.is_admin_or_ops_manager() to authenticated;

comment on function public.is_admin_or_ops_manager() is
  'True for admin/operations_manager. The single most repeated gate in this migration (write access on partners/airports/seat_categories/seats/flights/bookings/technician_jobs, and broad SELECT-all on most other tables) - centralized here instead of repeating the role-set check on every policy.';

-- Deviation from plan.md Task 3 (which names exactly 4 helper functions):
-- a 5th SECURITY DEFINER helper is required to break a real RLS
-- recursion cycle discovered by manually exercising this migration
-- (Postgres error 42P17 "infinite recursion detected in policy for
-- relation bookings"). bookings' technician-visibility policy (Task 12)
-- queries technician_jobs; technician_jobs' partner_user-visibility
-- policy (Task 14) queries bookings back via an inline
-- `exists (select ... from public.bookings ...)`. Each inline subquery on
-- an RLS-enabled table re-triggers that tables own policies, so the two
-- tables policies call each other forever. The fix mirrors the exact
-- mechanism plan.md already relies on for public.users
-- (current_user_role/current_user_partner_id): a SECURITY DEFINER
-- function owned by the migration role reads public.bookings directly,
-- bypassing its RLS, so the caller-side table (technician_jobs) never
-- re-enters bookings own policy evaluation.
create function public.booking_partner_id(p_booking_id uuid)
returns uuid
language sql
security definer
stable
set search_path = ''
as $$
  select partner_id
  from public.bookings
  where id = p_booking_id;
$$;

revoke execute on function public.booking_partner_id(uuid) from public;
revoke execute on function public.booking_partner_id(uuid) from anon;
grant execute on function public.booking_partner_id(uuid) to authenticated;

comment on function public.booking_partner_id(uuid) is
  'Returns the partner_id that owns the given booking, bypassing bookings RLS via SECURITY DEFINER. Exists specifically to break a two-table RLS recursion cycle between bookings and technician_jobs (see the comment above this function) - any policy that needs "which partner owns this booking" without re-entering bookings own policy evaluation should call this instead of an inline exists(...) against public.bookings.';

-- =============================================================================
-- Task 4: privilege-escalation trigger on public.users
-- =============================================================================
-- RLS USING/WITH CHECK clauses can only decide which rows a statement
-- touches, not diff old vs. new column values within an UPDATE. This
-- trigger blocks any non-admin caller from changing role, partner_id, or
-- is_active on any row, regardless of which UPDATE policy let the
-- statement through at the row level.
--
-- Deviation from plan.md's literal pseudocode: the plan wrote the role
-- guard as `current_user_role() <> 'admin'`. current_user_role() returns
-- null for a caller whose own profile is inactive/missing, and
-- `null <> 'admin'` evaluates to null, which a plpgsql `if` treats as
-- false - silently skipping the guard for exactly the caller it matters
-- most for (e.g. an already-inactive account trying to flip its own
-- is_active back to true). Using `is distinct from` instead of `<>`
-- fixes this: `null is distinct from 'admin'` is true, so the guard still
-- fires. This is a null-handling correctness fix, not a change to who is
-- allowed to do what.

create function public.prevent_users_privilege_escalation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.current_user_role() is distinct from 'admin' and (
    new.role is distinct from old.role
    or new.partner_id is distinct from old.partner_id
    or new.is_active is distinct from old.is_active
  ) then
    raise exception 'only admin may change role, partner_id, or is_active on public.users';
  end if;

  return new;
end;
$$;

comment on function public.prevent_users_privilege_escalation() is
  'BEFORE UPDATE guard on public.users: blocks any non-admin caller from changing their own (or anyone elses, if some future UPDATE policy allowed it) role/partner_id/is_active, independent of which UPDATE policy let the row-level statement through. RLS alone cannot express this old-vs-new column diff.';

create trigger prevent_users_privilege_escalation
  before update on public.users
  for each row
  execute function public.prevent_users_privilege_escalation();

-- =============================================================================
-- Task 5: users
-- =============================================================================

alter table public.users enable row level security;

create policy "users_select_admin_ops_manager"
  on public.users for select
  to authenticated
  using ((select public.is_admin_or_ops_manager()));

create policy "users_select_self"
  on public.users for select
  to authenticated
  using (id = (select auth.uid()));

create policy "users_insert_self"
  on public.users for insert
  to authenticated
  with check (id = (select auth.uid()));

create policy "users_update_admin"
  on public.users for update
  to authenticated
  using ((select public.current_user_role()) = 'admin')
  with check ((select public.current_user_role()) = 'admin');

create policy "users_update_self"
  on public.users for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- No DELETE policy on users - see Task 23.

-- =============================================================================
-- Task 6: partners
-- =============================================================================

alter table public.partners enable row level security;

create policy "partners_select_admin_ops_manager"
  on public.partners for select
  to authenticated
  using ((select public.is_admin_or_ops_manager()));

create policy "partners_select_partner_user"
  on public.partners for select
  to authenticated
  using (id = (select public.current_user_partner_id()));

create policy "partners_insert_admin_ops_manager"
  on public.partners for insert
  to authenticated
  with check ((select public.is_admin_or_ops_manager()));

create policy "partners_update_admin_ops_manager"
  on public.partners for update
  to authenticated
  using ((select public.is_admin_or_ops_manager()))
  with check ((select public.is_admin_or_ops_manager()));

-- =============================================================================
-- Task 7: airports (shared reference data)
-- =============================================================================

alter table public.airports enable row level security;

create policy "airports_select_authenticated"
  on public.airports for select
  to authenticated
  using (true);

create policy "airports_insert_admin_ops_manager"
  on public.airports for insert
  to authenticated
  with check ((select public.is_admin_or_ops_manager()));

create policy "airports_update_admin_ops_manager"
  on public.airports for update
  to authenticated
  using ((select public.is_admin_or_ops_manager()))
  with check ((select public.is_admin_or_ops_manager()));

-- =============================================================================
-- Task 8: seat_categories (shared reference data)
-- =============================================================================

alter table public.seat_categories enable row level security;

create policy "seat_categories_select_authenticated"
  on public.seat_categories for select
  to authenticated
  using (true);

create policy "seat_categories_insert_admin_ops_manager"
  on public.seat_categories for insert
  to authenticated
  with check ((select public.is_admin_or_ops_manager()));

create policy "seat_categories_update_admin_ops_manager"
  on public.seat_categories for update
  to authenticated
  using ((select public.is_admin_or_ops_manager()))
  with check ((select public.is_admin_or_ops_manager()));

-- =============================================================================
-- Task 9: seats
-- =============================================================================

alter table public.seats enable row level security;

create policy "seats_select_admin_ops_manager"
  on public.seats for select
  to authenticated
  using ((select public.is_admin_or_ops_manager()));

create policy "seats_select_technician"
  on public.seats for select
  to authenticated
  using (
    exists (
      select 1
      from public.bookings b
      join public.technician_jobs tj on tj.booking_id = b.id
      where b.assigned_seat_id = seats.id
        and tj.technician_id = (select auth.uid())
    )
  );

create policy "seats_select_partner_user"
  on public.seats for select
  to authenticated
  using (
    exists (
      select 1
      from public.bookings b
      where b.assigned_seat_id = seats.id
        and b.partner_id = (select public.current_user_partner_id())
    )
  );

create policy "seats_insert_admin_ops_manager"
  on public.seats for insert
  to authenticated
  with check ((select public.is_admin_or_ops_manager()));

create policy "seats_update_admin_ops_manager"
  on public.seats for update
  to authenticated
  using ((select public.is_admin_or_ops_manager()))
  with check ((select public.is_admin_or_ops_manager()));

-- =============================================================================
-- Task 10: seat_status_history (immutable log)
-- =============================================================================

alter table public.seat_status_history enable row level security;

create policy "seat_status_history_select_admin_ops_manager"
  on public.seat_status_history for select
  to authenticated
  using ((select public.is_admin_or_ops_manager()));

create policy "seat_status_history_insert_admin_ops_manager"
  on public.seat_status_history for insert
  to authenticated
  with check ((select public.is_admin_or_ops_manager()));

-- No UPDATE/DELETE policy - append-only log.

-- =============================================================================
-- Task 11: flights (shared reference data)
-- =============================================================================

alter table public.flights enable row level security;

create policy "flights_select_authenticated"
  on public.flights for select
  to authenticated
  using (true);

create policy "flights_insert_admin_ops_manager"
  on public.flights for insert
  to authenticated
  with check ((select public.is_admin_or_ops_manager()));

create policy "flights_update_admin_ops_manager"
  on public.flights for update
  to authenticated
  using ((select public.is_admin_or_ops_manager()))
  with check ((select public.is_admin_or_ops_manager()));

-- =============================================================================
-- Task 12: bookings
-- =============================================================================

alter table public.bookings enable row level security;

create policy "bookings_select_admin_ops_manager"
  on public.bookings for select
  to authenticated
  using ((select public.is_admin_or_ops_manager()));

create policy "bookings_select_technician"
  on public.bookings for select
  to authenticated
  using (
    assigned_technician_id = (select auth.uid())
    or exists (
      select 1
      from public.technician_jobs tj
      where tj.booking_id = bookings.id
        and tj.technician_id = (select auth.uid())
    )
  );

create policy "bookings_select_partner_user"
  on public.bookings for select
  to authenticated
  using (partner_id = (select public.current_user_partner_id()));

create policy "bookings_insert_admin_ops_manager"
  on public.bookings for insert
  to authenticated
  with check ((select public.is_admin_or_ops_manager()));

create policy "bookings_update_admin_ops_manager"
  on public.bookings for update
  to authenticated
  using ((select public.is_admin_or_ops_manager()))
  with check ((select public.is_admin_or_ops_manager()));

-- No DELETE policy - cancellation is an UPDATE (status = 'cancelled'),
-- already covered above.

-- =============================================================================
-- Task 13: booking_events (immutable log; ownership via booking_id -> bookings.partner_id)
-- =============================================================================

alter table public.booking_events enable row level security;

create policy "booking_events_select_admin_ops_manager"
  on public.booking_events for select
  to authenticated
  using ((select public.is_admin_or_ops_manager()));

create policy "booking_events_select_technician"
  on public.booking_events for select
  to authenticated
  using (
    exists (
      select 1
      from public.bookings b
      where b.id = booking_events.booking_id
        and (
          b.assigned_technician_id = (select auth.uid())
          or exists (
            select 1
            from public.technician_jobs tj
            where tj.booking_id = b.id
              and tj.technician_id = (select auth.uid())
          )
        )
    )
  );

create policy "booking_events_select_partner_user"
  on public.booking_events for select
  to authenticated
  using (
    exists (
      select 1
      from public.bookings b
      where b.id = booking_events.booking_id
        and b.partner_id = (select public.current_user_partner_id())
    )
  );

create policy "booking_events_insert_admin_ops_manager"
  on public.booking_events for insert
  to authenticated
  with check ((select public.is_admin_or_ops_manager()));

create policy "booking_events_insert_technician"
  on public.booking_events for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.bookings b
      where b.id = booking_events.booking_id
        and (
          b.assigned_technician_id = (select auth.uid())
          or exists (
            select 1
            from public.technician_jobs tj
            where tj.booking_id = b.id
              and tj.technician_id = (select auth.uid())
          )
        )
    )
  );

-- No UPDATE/DELETE policy - append-only log.

-- =============================================================================
-- Task 14: technician_jobs
-- =============================================================================

alter table public.technician_jobs enable row level security;

create policy "technician_jobs_select_admin_ops_manager"
  on public.technician_jobs for select
  to authenticated
  using ((select public.is_admin_or_ops_manager()));

create policy "technician_jobs_select_technician"
  on public.technician_jobs for select
  to authenticated
  using (technician_id = (select auth.uid()));

create policy "technician_jobs_select_partner_user"
  on public.technician_jobs for select
  to authenticated
  using (
    -- Uses booking_partner_id() rather than an inline exists(...) on
    -- public.bookings - see the comment on that function for why: an
    -- inline subquery here would re-trigger bookings own RLS policies,
    -- one of which queries this table, causing infinite recursion.
    (select public.booking_partner_id(technician_jobs.booking_id))
      = (select public.current_user_partner_id())
  );

create policy "technician_jobs_insert_admin_ops_manager"
  on public.technician_jobs for insert
  to authenticated
  with check ((select public.is_admin_or_ops_manager()));

create policy "technician_jobs_update_admin_ops_manager"
  on public.technician_jobs for update
  to authenticated
  using ((select public.is_admin_or_ops_manager()))
  with check ((select public.is_admin_or_ops_manager()));

create policy "technician_jobs_update_technician"
  on public.technician_jobs for update
  to authenticated
  using (technician_id = (select auth.uid()))
  with check (technician_id = (select auth.uid()));

-- Note (plan.md open question 7, deliberately deferred): this policy
-- stops a technician reassigning technician_id to someone else, but does
-- not stop them changing booking_id to an unrelated booking. Left as a
-- known gap for F14/F15, no UI can exploit it today.

-- =============================================================================
-- Task 15: installations (immutable log; ownership via technician_job_id)
-- =============================================================================

alter table public.installations enable row level security;

create policy "installations_select_admin_ops_manager"
  on public.installations for select
  to authenticated
  using ((select public.is_admin_or_ops_manager()));

create policy "installations_select_technician"
  on public.installations for select
  to authenticated
  using (
    exists (
      select 1
      from public.technician_jobs tj
      where tj.id = installations.technician_job_id
        and tj.technician_id = (select auth.uid())
    )
  );

create policy "installations_select_partner_user"
  on public.installations for select
  to authenticated
  using (
    exists (
      select 1
      from public.technician_jobs tj
      join public.bookings b on b.id = tj.booking_id
      where tj.id = installations.technician_job_id
        and b.partner_id = (select public.current_user_partner_id())
    )
  );

create policy "installations_insert_technician"
  on public.installations for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.technician_jobs tj
      where tj.id = installations.technician_job_id
        and tj.technician_id = (select auth.uid())
    )
  );

create policy "installations_insert_admin_ops_manager"
  on public.installations for insert
  to authenticated
  with check ((select public.is_admin_or_ops_manager()));

-- No UPDATE/DELETE policy - records are complete/immutable once written.

create index installations_technician_job_id_idx on public.installations(technician_job_id);

-- =============================================================================
-- Task 16: cleaning_records (immutable log; booking_id nullable)
-- =============================================================================

alter table public.cleaning_records enable row level security;

create policy "cleaning_records_select_admin_ops_manager"
  on public.cleaning_records for select
  to authenticated
  using ((select public.is_admin_or_ops_manager()));

create policy "cleaning_records_select_technician"
  on public.cleaning_records for select
  to authenticated
  using (employee_id = (select auth.uid()));

create policy "cleaning_records_select_partner_user"
  on public.cleaning_records for select
  to authenticated
  using (
    booking_id is not null
    and exists (
      select 1
      from public.bookings b
      where b.id = cleaning_records.booking_id
        and b.partner_id = (select public.current_user_partner_id())
    )
  );

create policy "cleaning_records_insert_technician"
  on public.cleaning_records for insert
  to authenticated
  with check (employee_id = (select auth.uid()));

create policy "cleaning_records_insert_admin_ops_manager"
  on public.cleaning_records for insert
  to authenticated
  with check ((select public.is_admin_or_ops_manager()));

-- No UPDATE/DELETE policy - records are complete/immutable once written.

create index cleaning_records_employee_id_idx on public.cleaning_records(employee_id);
create index cleaning_records_booking_id_idx on public.cleaning_records(booking_id);

-- =============================================================================
-- Task 17: inspection_records (immutable log; same shape as cleaning_records)
-- =============================================================================

alter table public.inspection_records enable row level security;

create policy "inspection_records_select_admin_ops_manager"
  on public.inspection_records for select
  to authenticated
  using ((select public.is_admin_or_ops_manager()));

create policy "inspection_records_select_technician"
  on public.inspection_records for select
  to authenticated
  using (inspector_id = (select auth.uid()));

create policy "inspection_records_select_partner_user"
  on public.inspection_records for select
  to authenticated
  using (
    booking_id is not null
    and exists (
      select 1
      from public.bookings b
      where b.id = inspection_records.booking_id
        and b.partner_id = (select public.current_user_partner_id())
    )
  );

create policy "inspection_records_insert_technician"
  on public.inspection_records for insert
  to authenticated
  with check (inspector_id = (select auth.uid()));

create policy "inspection_records_insert_admin_ops_manager"
  on public.inspection_records for insert
  to authenticated
  with check ((select public.is_admin_or_ops_manager()));

-- No UPDATE/DELETE policy - records are complete/immutable once written.

create index inspection_records_inspector_id_idx on public.inspection_records(inspector_id);
create index inspection_records_booking_id_idx on public.inspection_records(booking_id);

-- =============================================================================
-- Task 18: incidents
-- =============================================================================
-- incidents.partner_id is a client-writable column, not derived from
-- booking_id - both INSERT policies below require it to match the
-- referenced bookings real partner_id whenever booking_id is supplied,
-- so no authenticated inserter (technician or admin/ops_manager) can
-- mis-assign an incident to a partner unrelated to the booking it cites.

alter table public.incidents enable row level security;

create policy "incidents_select_admin_ops_manager"
  on public.incidents for select
  to authenticated
  using ((select public.is_admin_or_ops_manager()));

create policy "incidents_select_technician"
  on public.incidents for select
  to authenticated
  using (reported_by = (select auth.uid()));

create policy "incidents_select_partner_user"
  on public.incidents for select
  to authenticated
  using (partner_id = (select public.current_user_partner_id()));

create policy "incidents_insert_technician"
  on public.incidents for insert
  to authenticated
  with check (
    reported_by = (select auth.uid())
    and (
      booking_id is null
      or partner_id = (select b.partner_id from public.bookings b where b.id = incidents.booking_id)
    )
  );

create policy "incidents_insert_admin_ops_manager"
  on public.incidents for insert
  to authenticated
  with check (
    (select public.is_admin_or_ops_manager())
    and (
      booking_id is null
      or partner_id = (select b.partner_id from public.bookings b where b.id = incidents.booking_id)
    )
  );

create policy "incidents_update_admin"
  on public.incidents for update
  to authenticated
  using ((select public.current_user_role()) = 'admin')
  with check ((select public.current_user_role()) = 'admin');

-- UPDATE is admin-only, matching F04's permission table exactly:
-- operations_manager only has incidents:view, no manage/resolve
-- permission (plan.md open question 3 - not this feature's call to
-- widen).

-- No DELETE policy.

create index incidents_reported_by_idx on public.incidents(reported_by);

-- =============================================================================
-- Task 19: partner_commercial_terms
-- =============================================================================

alter table public.partner_commercial_terms enable row level security;

create policy "partner_commercial_terms_select_admin_ops_manager"
  on public.partner_commercial_terms for select
  to authenticated
  using ((select public.is_admin_or_ops_manager()));

create policy "partner_commercial_terms_select_partner_user"
  on public.partner_commercial_terms for select
  to authenticated
  using (partner_id = (select public.current_user_partner_id()));

create policy "partner_commercial_terms_insert_admin"
  on public.partner_commercial_terms for insert
  to authenticated
  with check ((select public.current_user_role()) = 'admin');

create policy "partner_commercial_terms_update_admin"
  on public.partner_commercial_terms for update
  to authenticated
  using ((select public.current_user_role()) = 'admin')
  with check ((select public.current_user_role()) = 'admin');

-- INSERT/UPDATE is admin-only: F04 has no finance:manage permission for
-- any non-admin role, so this is not a new restriction RLS introduces
-- (plan.md open question 4).

-- =============================================================================
-- Task 20: settlements (same shape as partner_commercial_terms)
-- =============================================================================

alter table public.settlements enable row level security;

create policy "settlements_select_admin_ops_manager"
  on public.settlements for select
  to authenticated
  using ((select public.is_admin_or_ops_manager()));

create policy "settlements_select_partner_user"
  on public.settlements for select
  to authenticated
  using (partner_id = (select public.current_user_partner_id()));

create policy "settlements_insert_admin"
  on public.settlements for insert
  to authenticated
  with check ((select public.current_user_role()) = 'admin');

create policy "settlements_update_admin"
  on public.settlements for update
  to authenticated
  using ((select public.current_user_role()) = 'admin')
  with check ((select public.current_user_role()) = 'admin');

-- =============================================================================
-- Task 21: invoices (same shape again)
-- =============================================================================

alter table public.invoices enable row level security;

create policy "invoices_select_admin_ops_manager"
  on public.invoices for select
  to authenticated
  using ((select public.is_admin_or_ops_manager()));

create policy "invoices_select_partner_user"
  on public.invoices for select
  to authenticated
  using (partner_id = (select public.current_user_partner_id()));

create policy "invoices_insert_admin"
  on public.invoices for insert
  to authenticated
  with check ((select public.current_user_role()) = 'admin');

create policy "invoices_update_admin"
  on public.invoices for update
  to authenticated
  using ((select public.current_user_role()) = 'admin')
  with check ((select public.current_user_role()) = 'admin');

-- =============================================================================
-- Task 22: ai_queries
-- =============================================================================
-- No ai:* permission exists in F04 and F28 has not started - the most
-- conservative shape in this migration. Own-query visibility plus admin
-- oversight only, no partner-wide visibility (plan.md open question 6).

alter table public.ai_queries enable row level security;

create policy "ai_queries_select_own_or_admin"
  on public.ai_queries for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.current_user_role()) = 'admin'
  );

create policy "ai_queries_insert_own_or_admin"
  on public.ai_queries for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    or (select public.current_user_role()) = 'admin'
  );

-- No UPDATE/DELETE policy - log table. INSERT is scaffolding: no code
-- path writes to ai_queries yet (F28 has not started).

create index ai_queries_user_id_idx on public.ai_queries(user_id);

-- =============================================================================
-- Task 23: no DELETE policy anywhere (project-wide decision)
-- =============================================================================
-- No table in this migration has a DELETE policy for any authenticated
-- role. This is a deliberate, uniform decision - consistent with
-- docs/database.md's "no ON DELETE CASCADE ... partners/seats/bookings
-- are deactivated via status, never hard-deleted" convention - not a
-- per-table oversight. The absence of a matching policy means RLS denies
-- every DELETE by default on every table above.

-- =============================================================================
-- Task 25: rollback (run manually against the target database if needed)
-- =============================================================================
-- Reverse order: policies, then trigger, then Task 24 indexes, then
-- helper functions, then disable RLS.
--
-- drop policy if exists "ai_queries_insert_own_or_admin" on public.ai_queries;
-- drop policy if exists "ai_queries_select_own_or_admin" on public.ai_queries;
-- drop policy if exists "invoices_update_admin" on public.invoices;
-- drop policy if exists "invoices_insert_admin" on public.invoices;
-- drop policy if exists "invoices_select_partner_user" on public.invoices;
-- drop policy if exists "invoices_select_admin_ops_manager" on public.invoices;
-- drop policy if exists "settlements_update_admin" on public.settlements;
-- drop policy if exists "settlements_insert_admin" on public.settlements;
-- drop policy if exists "settlements_select_partner_user" on public.settlements;
-- drop policy if exists "settlements_select_admin_ops_manager" on public.settlements;
-- drop policy if exists "partner_commercial_terms_update_admin" on public.partner_commercial_terms;
-- drop policy if exists "partner_commercial_terms_insert_admin" on public.partner_commercial_terms;
-- drop policy if exists "partner_commercial_terms_select_partner_user" on public.partner_commercial_terms;
-- drop policy if exists "partner_commercial_terms_select_admin_ops_manager" on public.partner_commercial_terms;
-- drop policy if exists "incidents_update_admin" on public.incidents;
-- drop policy if exists "incidents_insert_admin_ops_manager" on public.incidents;
-- drop policy if exists "incidents_insert_technician" on public.incidents;
-- drop policy if exists "incidents_select_partner_user" on public.incidents;
-- drop policy if exists "incidents_select_technician" on public.incidents;
-- drop policy if exists "incidents_select_admin_ops_manager" on public.incidents;
-- drop policy if exists "inspection_records_insert_admin_ops_manager" on public.inspection_records;
-- drop policy if exists "inspection_records_insert_technician" on public.inspection_records;
-- drop policy if exists "inspection_records_select_partner_user" on public.inspection_records;
-- drop policy if exists "inspection_records_select_technician" on public.inspection_records;
-- drop policy if exists "inspection_records_select_admin_ops_manager" on public.inspection_records;
-- drop policy if exists "cleaning_records_insert_admin_ops_manager" on public.cleaning_records;
-- drop policy if exists "cleaning_records_insert_technician" on public.cleaning_records;
-- drop policy if exists "cleaning_records_select_partner_user" on public.cleaning_records;
-- drop policy if exists "cleaning_records_select_technician" on public.cleaning_records;
-- drop policy if exists "cleaning_records_select_admin_ops_manager" on public.cleaning_records;
-- drop policy if exists "installations_insert_admin_ops_manager" on public.installations;
-- drop policy if exists "installations_insert_technician" on public.installations;
-- drop policy if exists "installations_select_partner_user" on public.installations;
-- drop policy if exists "installations_select_technician" on public.installations;
-- drop policy if exists "installations_select_admin_ops_manager" on public.installations;
-- drop policy if exists "technician_jobs_update_technician" on public.technician_jobs;
-- drop policy if exists "technician_jobs_update_admin_ops_manager" on public.technician_jobs;
-- drop policy if exists "technician_jobs_insert_admin_ops_manager" on public.technician_jobs;
-- drop policy if exists "technician_jobs_select_partner_user" on public.technician_jobs;
-- drop policy if exists "technician_jobs_select_technician" on public.technician_jobs;
-- drop policy if exists "technician_jobs_select_admin_ops_manager" on public.technician_jobs;
-- drop policy if exists "booking_events_insert_technician" on public.booking_events;
-- drop policy if exists "booking_events_insert_admin_ops_manager" on public.booking_events;
-- drop policy if exists "booking_events_select_partner_user" on public.booking_events;
-- drop policy if exists "booking_events_select_technician" on public.booking_events;
-- drop policy if exists "booking_events_select_admin_ops_manager" on public.booking_events;
-- drop policy if exists "bookings_update_admin_ops_manager" on public.bookings;
-- drop policy if exists "bookings_insert_admin_ops_manager" on public.bookings;
-- drop policy if exists "bookings_select_partner_user" on public.bookings;
-- drop policy if exists "bookings_select_technician" on public.bookings;
-- drop policy if exists "bookings_select_admin_ops_manager" on public.bookings;
-- drop policy if exists "flights_update_admin_ops_manager" on public.flights;
-- drop policy if exists "flights_insert_admin_ops_manager" on public.flights;
-- drop policy if exists "flights_select_authenticated" on public.flights;
-- drop policy if exists "seat_status_history_insert_admin_ops_manager" on public.seat_status_history;
-- drop policy if exists "seat_status_history_select_admin_ops_manager" on public.seat_status_history;
-- drop policy if exists "seats_update_admin_ops_manager" on public.seats;
-- drop policy if exists "seats_insert_admin_ops_manager" on public.seats;
-- drop policy if exists "seats_select_partner_user" on public.seats;
-- drop policy if exists "seats_select_technician" on public.seats;
-- drop policy if exists "seats_select_admin_ops_manager" on public.seats;
-- drop policy if exists "seat_categories_update_admin_ops_manager" on public.seat_categories;
-- drop policy if exists "seat_categories_insert_admin_ops_manager" on public.seat_categories;
-- drop policy if exists "seat_categories_select_authenticated" on public.seat_categories;
-- drop policy if exists "airports_update_admin_ops_manager" on public.airports;
-- drop policy if exists "airports_insert_admin_ops_manager" on public.airports;
-- drop policy if exists "airports_select_authenticated" on public.airports;
-- drop policy if exists "partners_update_admin_ops_manager" on public.partners;
-- drop policy if exists "partners_insert_admin_ops_manager" on public.partners;
-- drop policy if exists "partners_select_partner_user" on public.partners;
-- drop policy if exists "partners_select_admin_ops_manager" on public.partners;
-- drop policy if exists "users_update_self" on public.users;
-- drop policy if exists "users_update_admin" on public.users;
-- drop policy if exists "users_insert_self" on public.users;
-- drop policy if exists "users_select_self" on public.users;
-- drop policy if exists "users_select_admin_ops_manager" on public.users;
--
-- drop trigger if exists prevent_users_privilege_escalation on public.users;
--
-- drop index if exists ai_queries_user_id_idx;
-- drop index if exists incidents_reported_by_idx;
-- drop index if exists inspection_records_booking_id_idx;
-- drop index if exists inspection_records_inspector_id_idx;
-- drop index if exists cleaning_records_booking_id_idx;
-- drop index if exists cleaning_records_employee_id_idx;
-- drop index if exists installations_technician_job_id_idx;
--
-- drop function if exists public.prevent_users_privilege_escalation();
-- drop function if exists public.booking_partner_id(uuid);
-- drop function if exists public.is_admin_or_ops_manager();
-- drop function if exists public.is_internal_user();
-- drop function if exists public.current_user_partner_id();
-- drop function if exists public.current_user_role();
--
-- alter table public.ai_queries disable row level security;
-- alter table public.invoices disable row level security;
-- alter table public.settlements disable row level security;
-- alter table public.partner_commercial_terms disable row level security;
-- alter table public.incidents disable row level security;
-- alter table public.inspection_records disable row level security;
-- alter table public.cleaning_records disable row level security;
-- alter table public.installations disable row level security;
-- alter table public.technician_jobs disable row level security;
-- alter table public.booking_events disable row level security;
-- alter table public.bookings disable row level security;
-- alter table public.flights disable row level security;
-- alter table public.seat_status_history disable row level security;
-- alter table public.seats disable row level security;
-- alter table public.seat_categories disable row level security;
-- alter table public.airports disable row level security;
-- alter table public.partners disable row level security;
-- alter table public.users disable row level security;
