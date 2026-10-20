-- FO-F05-S07: scope incident access.
--
-- incidents_select_technician only checked reported_by = auth.uid(). It did
-- not check that the user is still an active technician, so a deactivated
-- technician could still read their incidents, and it left out an incident on
-- a job assigned to the technician that someone else reported (spec: "own or
-- assigned"). A technician now reads an incident when they are an active
-- technician and either reported it or the job it was reported on is assigned
-- to them. Admin/ops and partner user policies are unchanged: admin/ops read
-- all, a partner user reads the incidents of their own partner (and none when
-- inactive, because current_user_partner_id() is then null).

drop policy "incidents_select_technician" on public.incidents;

create policy "incidents_select_technician"
  on public.incidents for select
  to authenticated
  using (
    (select public.current_user_role()) = 'technician'
    and (
      reported_by = (select auth.uid())
      or exists (
        select 1
          from public.technician_jobs tj
         where tj.id = incidents.technician_job_id
           and tj.technician_id = (select auth.uid())
      )
    )
  );

-- Rollback (run manually against the target database if needed):
-- drop policy if exists "incidents_select_technician" on public.incidents;
-- create policy "incidents_select_technician"
--   on public.incidents for select
--   to authenticated
--   using (reported_by = (select auth.uid()));
