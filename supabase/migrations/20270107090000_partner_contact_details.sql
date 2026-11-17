-- Partner detail: a contact name, a contact phone and free notes on a partner.
--
-- All three are optional. Existing rows keep null. RLS is unchanged: the existing partners
-- policies apply to the new columns as they do to the others.

alter table public.partners
  add column if not exists contact_name text,
  add column if not exists contact_phone text,
  add column if not exists notes text;
