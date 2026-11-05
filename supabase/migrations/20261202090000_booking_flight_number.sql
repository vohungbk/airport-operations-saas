-- VI-F02-S01: a booking keeps the flight number it was saved with and the result of looking the
-- flight up. `flight_id` (already there) points at the linked flight; it stays null when the
-- flight is not found. RLS of `bookings` already covers these columns (no new policy), and the
-- guard trigger does not protect them: like `flight_id`, they are written by operations after a
-- booking is saved.
--
-- Rollback (run manually against the target database if needed):
-- drop index if exists public.flights_lookup_idx;
-- alter table public.bookings drop constraint if exists bookings_flight_lookup_status_check;
-- alter table public.bookings drop constraint if exists bookings_flight_number_format_check;
-- alter table public.bookings drop constraint if exists bookings_flight_lookup_needs_number_check;
-- alter table public.bookings drop column if exists flight_lookup_status;
-- alter table public.bookings drop column if exists flight_number;

alter table public.bookings
  add column flight_number text,
  add column flight_lookup_status text;

-- Upper-case letters and digits, as printed on a ticket (for example VN123).
alter table public.bookings
  add constraint bookings_flight_number_format_check
  check (flight_number is null or flight_number ~ '^[A-Z0-9]{2,8}$');

-- null = not looked up (no number, or the lookup did not run); linked; not_found.
alter table public.bookings
  add constraint bookings_flight_lookup_status_check
  check (flight_lookup_status is null or flight_lookup_status in ('linked', 'not_found'));

-- A lookup result always belongs to a number.
alter table public.bookings
  add constraint bookings_flight_lookup_needs_number_check
  check (flight_lookup_status is null or flight_number is not null);

-- Finding the flight a booking is saved with: same number at the same airport and time.
create index flights_lookup_idx
  on public.flights(flight_number, airport_id, scheduled_arrival_at);
