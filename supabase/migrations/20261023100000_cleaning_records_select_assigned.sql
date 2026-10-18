-- FO-F03-S04: the assigned technician can read the cleaning of their job.
--
-- cleaning_records_select_technician only matched employee_id = auth.uid(),
-- the user who started the cleaning. When an admin or operations manager
-- starts it on a technician's job, the technician could not read the record:
-- the screen offered Start again and could never reach Complete. The policy
-- now also lets a technician read the record of a job assigned to them (as
-- the installations policy already does). Admin/ops and partner policies are
-- unchanged; another technician still sees nothing.

drop policy "cleaning_records_select_technician" on public.cleaning_records;

create policy "cleaning_records_select_technician"
  on public.cleaning_records for select
  to authenticated
  using (
    employee_id = (select auth.uid())
    or exists (
      select 1
      from public.technician_jobs tj
      where tj.id = cleaning_records.technician_job_id
        and tj.technician_id = (select auth.uid())
    )
  );

-- Rollback (run manually against the target database if needed):
-- drop policy if exists "cleaning_records_select_technician" on public.cleaning_records;
-- create policy "cleaning_records_select_technician"
--   on public.cleaning_records for select
--   to authenticated
--   using (employee_id = (select auth.uid()));
