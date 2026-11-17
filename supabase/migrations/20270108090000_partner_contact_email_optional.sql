-- Partner form: the contact email is optional, like the contact name and phone.
--
-- Existing rows keep their email. RLS is unchanged.

alter table public.partners
  alter column contact_email drop not null;
