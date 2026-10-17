-- FO-F03-S03: keep cleaning records unchanged.
--
-- cleaning_records is an immutable log: it has no UPDATE or DELETE policy, so
-- RLS already blocks both. Supabase still grants UPDATE, DELETE and TRUNCATE
-- on public tables to anon and authenticated, and TRUNCATE is not covered by
-- RLS. Revoke them so the log does not depend on RLS alone. INSERT and
-- SELECT keep their grants (RLS and the insert guard trigger scope them).
-- service_role and the table owner are not affected.

revoke update, delete, truncate on public.cleaning_records from anon, authenticated;

-- Rollback (run manually against the target database if needed):
-- grant update, delete, truncate on public.cleaning_records to anon, authenticated;
