-- VI-F11-T01: every job has its own number.
--
-- A job number looks like JOB-2026-000123: the year the job was made (UTC) and a six-digit
-- counter. The counter is one sequence for all years and never starts again, so a number is unique
-- for ever and is never given twice, even when a job is deleted or an insert is rolled back (the
-- sequence is not rolled back; a gap is harmless). The sequence stops at 999999 so the six digits
-- are never cut short.
--
-- The number is made by the database. It cannot be set on insert and cannot be changed:
--   55000  the client sent a job number, or tried to change one
--
-- Jobs that exist before this migration are numbered here, oldest first (created_at, then id),
-- with the year of their own created_at. Their updated_at is not touched.

create sequence public.job_number_seq start with 1 minvalue 1 maxvalue 999999 no cycle;

revoke all on sequence public.job_number_seq from public, anon, authenticated;

-- Only the trigger and this migration call it, both as the owner.
create function public.generate_job_number(p_created_at timestamptz)
returns text
language sql
security definer
set search_path = ''
as $$
  select 'JOB-' || to_char(p_created_at at time zone 'UTC', 'YYYY') || '-'
         || lpad(nextval('public.job_number_seq')::text, 6, '0');
$$;

revoke execute on function public.generate_job_number(timestamptz) from public, anon, authenticated;

alter table public.technician_jobs
  add column job_number text;

-- Backfill, one job at a time so the numbers follow the order the jobs were made.
-- The updated_at trigger is switched off for it: the number is not an edit of the job.
alter table public.technician_jobs disable trigger set_technician_jobs_updated_at;

do $$
declare
  v_job record;
begin
  for v_job in
    select tj.id, tj.created_at
      from public.technician_jobs tj
     order by tj.created_at, tj.id
  loop
    update public.technician_jobs
       set job_number = public.generate_job_number(v_job.created_at)
     where id = v_job.id;
  end loop;
end
$$;

alter table public.technician_jobs enable trigger set_technician_jobs_updated_at;

alter table public.technician_jobs
  alter column job_number set not null,
  add constraint technician_jobs_job_number_key unique (job_number),
  add constraint technician_jobs_job_number_format_check
    check (job_number ~ '^JOB-[0-9]{4}-[0-9]{6}$');

-- A new job gets the next number. A number sent by the client is refused, not ignored.
create function public.set_technician_job_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.job_number is not null then
    raise exception 'The job number is created by the database' using errcode = '55000';
  end if;

  -- now(), not new.created_at: a client can send created_at, and the year must be the year of the insert.
  new.job_number := public.generate_job_number(now());

  return new;
end;
$$;

-- The number never changes, whoever updates the job.
create function public.guard_technician_job_number()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'The job number cannot be changed' using errcode = '55000';
end;
$$;

create trigger set_technician_jobs_job_number
  before insert on public.technician_jobs
  for each row
  execute function public.set_technician_job_number();

create trigger guard_technician_jobs_job_number
  before update on public.technician_jobs
  for each row
  when (new.job_number is distinct from old.job_number)
  execute function public.guard_technician_job_number();

revoke execute on function public.set_technician_job_number() from public, anon, authenticated;
revoke execute on function public.guard_technician_job_number() from public, anon, authenticated;

-- Rollback (run manually against the target database if needed):
-- drop trigger if exists guard_technician_jobs_job_number on public.technician_jobs;
-- drop trigger if exists set_technician_jobs_job_number on public.technician_jobs;
-- drop function if exists public.guard_technician_job_number();
-- drop function if exists public.set_technician_job_number();
-- alter table public.technician_jobs drop column if exists job_number;
-- drop function if exists public.generate_job_number(timestamptz);
-- drop sequence if exists public.job_number_seq;
