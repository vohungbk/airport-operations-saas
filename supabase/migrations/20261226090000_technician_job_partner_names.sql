-- VI-F11-T02: a technician sees the display name of the partner of a job assigned to them,
-- and nothing else of the partner.
--
-- The partners table holds commercial terms, revenue share and credit, so a technician has no policy on
-- it and reads no row. The row-level security of partners is NOT changed. This function reads the name
-- for the technician instead: it is SECURITY DEFINER, because the partner row is out of the technician's
-- reach, and it narrows the answer itself:
--   * only the columns job_id and partner_name come back, so no other partner field can be asked for;
--   * only the jobs whose technician is the signed-in user, so another technician's job gives no name;
--   * only for the technician role, so no other role gets a name through it.
-- A technician with no assigned job, or a caller who is not signed in, gets no row.
--
-- Rollback: drop function public.technician_job_partner_names(uuid[]);

create function public.technician_job_partner_names(p_job_ids uuid[])
returns table (
  job_id uuid,
  partner_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select tj.id as job_id, p.name as partner_name
  from public.technician_jobs tj
  join public.bookings b on b.id = tj.booking_id
  join public.partners p on p.id = b.partner_id
  where tj.id = any (p_job_ids)
    and tj.technician_id = auth.uid()
    and public.current_user_role() = 'technician';
$$;

revoke execute on function public.technician_job_partner_names(uuid[]) from public, anon;
grant execute on function public.technician_job_partner_names(uuid[]) to authenticated;

comment on function public.technician_job_partner_names(uuid[]) is
  'The display name of the partner of each of the given jobs that is assigned to the signed-in technician. SECURITY DEFINER so a technician needs no read access to partners; returns only job_id and partner_name.';
