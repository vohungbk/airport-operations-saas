-- FO-F04-S06: a technician whose access was revoked cannot record an inspection.
--
-- inspection_records_insert_technician checked only that the record is the
-- caller's and that the job is assigned to the caller. A technician who was
-- deactivated (or whose role was changed) while the screen was open could
-- still insert. current_user_role() returns a role only for an active user, so
-- requiring it to be 'technician' rejects them with 42501, the same as the
-- cleaning functions and the admin/ops policy (is_admin_or_ops_manager()).

drop policy "inspection_records_insert_technician" on public.inspection_records;

create policy "inspection_records_insert_technician"
  on public.inspection_records for insert
  to authenticated
  with check (
    (select public.current_user_role()) = 'technician'
    and inspector_id = (select auth.uid())
    and exists (
      select 1
      from public.technician_jobs tj
      where tj.id = inspection_records.technician_job_id
        and tj.technician_id = (select auth.uid())
    )
  );

-- Rollback (run manually against the target database if needed):
-- drop policy if exists "inspection_records_insert_technician" on public.inspection_records;
-- create policy "inspection_records_insert_technician"
--   on public.inspection_records for insert
--   to authenticated
--   with check (
--     inspector_id = (select auth.uid())
--     and exists (
--       select 1
--       from public.technician_jobs tj
--       where tj.id = inspection_records.technician_job_id
--         and tj.technician_id = (select auth.uid())
--     )
--   );
