-- F02: deterministic development seed data.
-- Every row uses a fixed literal UUID (never gen_random_uuid()) so that
-- repeated `supabase db reset` runs produce byte-identical ids.

-- 1 airport (DXB)
insert into public.airports (id, code, name, city, country, timezone)
values (
  'a0000000-0000-0000-0000-000000000001',
  'DXB',
  'Dubai International Airport',
  'Dubai',
  'United Arab Emirates',
  'Asia/Dubai'
);

-- 2 partners
insert into public.partners (id, name, code, contact_email, status)
values
  ('b0000000-0000-0000-0000-000000000001', 'Emirates Rent A Car', 'ERAC', 'ops@emiratesrentacar.example', 'active'),
  ('b0000000-0000-0000-0000-000000000002', 'Al Futtaim Mobility', 'AFM', 'ops@alfuttaimmobility.example', 'active');

-- 4 seat categories (ages in months)
insert into public.seat_categories (id, name, description, min_child_age, max_child_age, safety_standard, is_active)
values
  ('c0000000-0000-0000-0000-000000000001', 'Infant Carrier', 'Rear-facing infant carrier', 0, 15, 'UN R129 (i-Size)', true),
  ('c0000000-0000-0000-0000-000000000002', 'Convertible', 'Rear- and forward-facing convertible seat', 6, 48, 'UN R129 (i-Size)', true),
  ('c0000000-0000-0000-0000-000000000003', 'Booster', 'High-back booster seat', 36, 96, 'UN R44/04', true),
  ('c0000000-0000-0000-0000-000000000004', 'All-in-One', 'Infant through booster convertible seat', 0, 96, 'UN R129 (i-Size)', true);

-- 3 technician users
insert into public.users (id, email, full_name, role, partner_id, is_active)
values
  ('d0000000-0000-0000-0000-000000000001', 'technician1@airportops.example', 'Ahmed Al Mazrouei', 'technician', null, true),
  ('d0000000-0000-0000-0000-000000000002', 'technician2@airportops.example', 'Fatima Al Suwaidi', 'technician', null, true),
  ('d0000000-0000-0000-0000-000000000003', 'technician3@airportops.example', 'Rashid Al Nuaimi', 'technician', null, true);

-- 40 seats, deterministic uuids via a fixed prefix + zero-padded sequence
insert into public.seats (
  id, serial_number, manufacturer, model, category_id, airport_id,
  status, manufacture_date, purchase_date, max_rental_cycles
)
select
  ('e0000000-0000-0000-0000-' || lpad(gs::text, 12, '0'))::uuid,
  'SEAT-' || lpad(gs::text, 4, '0'),
  case (gs % 3) when 0 then 'Britax' when 1 then 'Chicco' else 'Maxi-Cosi' end,
  case (gs % 4)
    when 0 then 'Infant Carrier X1'
    when 1 then 'Convertible C2'
    when 2 then 'Booster B3'
    else 'All-in-One A4'
  end,
  (array[
    'c0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000003',
    'c0000000-0000-0000-0000-000000000004'
  ]::uuid[])[(gs % 4) + 1],
  'a0000000-0000-0000-0000-000000000001',
  'available',
  date '2024-01-01' + (gs || ' days')::interval,
  date '2024-02-01' + (gs || ' days')::interval,
  500
from generate_series(1, 40) as gs;

-- 20 bookings, deterministic uuids via a fixed prefix + zero-padded sequence
insert into public.bookings (
  id, booking_number, partner_id, airport_id, pickup_at, return_at,
  seat_category_id, assigned_seat_id, assigned_technician_id,
  daily_rate, paid_days, status
)
select
  ('f0000000-0000-0000-0000-' || lpad(gs::text, 12, '0'))::uuid,
  'BK-' || lpad(gs::text, 5, '0'),
  (array[
    'b0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000002'
  ]::uuid[])[(gs % 2) + 1],
  'a0000000-0000-0000-0000-000000000001',
  timestamptz '2026-09-01 08:00:00+04' + (gs || ' hours')::interval,
  timestamptz '2026-09-04 08:00:00+04' + (gs || ' hours')::interval,
  (array[
    'c0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000003',
    'c0000000-0000-0000-0000-000000000004'
  ]::uuid[])[(gs % 4) + 1],
  ('e0000000-0000-0000-0000-' || lpad(gs::text, 12, '0'))::uuid,
  (array[
    'd0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000002',
    'd0000000-0000-0000-0000-000000000003'
  ]::uuid[])[(gs % 3) + 1],
  75.00,
  3,
  'confirmed'
from generate_series(1, 20) as gs;
