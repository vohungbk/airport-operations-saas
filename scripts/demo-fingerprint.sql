-- A fingerprint of the data of the local database: for each table, the number
-- of rows and an md5 of every column of every row, in an order that does not
-- depend on where the rows are stored. Nothing is left out. Two loads of the
-- demo data (VI-F07-S02) are the same data when their fingerprints are equal.
--
-- Meant for a database that was just reset: any other row (a test account, a
-- session) is part of the fingerprint too. Run it with scripts/demo-determinism.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned

select format(
  'select %L as table_name, count(*) as row_count, coalesce(md5(string_agg(to_jsonb(t)::text, %L order by to_jsonb(t)::text)), %L) as fingerprint from %s t',
  c.table_schema || '.' || c.table_name, '|', 'empty',
  quote_ident(c.table_schema) || '.' || quote_ident(c.table_name)
)
from information_schema.tables c
where c.table_type = 'BASE TABLE'
  and (
    c.table_schema = 'public'
    or (c.table_schema = 'auth' and c.table_name in ('users', 'identities'))
  )
order by c.table_schema, c.table_name
\gexec
