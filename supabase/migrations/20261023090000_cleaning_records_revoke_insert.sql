-- FO-F03-S04: cleaning is recorded only through start_cleaning() and
-- complete_cleaning().
--
-- Direct INSERT into cleaning_records created a record without moving the
-- seat. The screen now uses the two functions, so INSERT is revoked from
-- anon and authenticated. The functions are SECURITY DEFINER and are not
-- affected; service_role and the table owner keep their access (fixtures and
-- trusted server code). The insert policies and guard_cleaning_insert() stay:
-- they only matter if the grant is ever restored.
--
-- With UPDATE, DELETE and TRUNCATE already revoked (20261021090000), a client
-- can only read cleaning_records.

revoke insert on public.cleaning_records from anon, authenticated;

-- Rollback (run manually against the target database if needed):
-- grant insert on public.cleaning_records to anon, authenticated;
