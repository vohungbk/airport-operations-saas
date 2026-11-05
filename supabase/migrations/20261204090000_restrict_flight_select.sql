-- VI-F02-S13: restrict flight access (spec VI-F02 R15, E7).
--
-- flights had one select policy, "flights_select_authenticated" (using true): any signed-in user, a partner user and a
-- technician included, could read every flight. The flight a booking is linked to is the only reason a partner user
-- or a technician needs to read a flight, so the policy is replaced by three, by who may see the booking:
--   * admin and operations manager: every flight.
--   * partner user: the flights of the bookings of its own partner.
--   * technician: the flights of the bookings it is assigned to, or has a job on (the same rule as
--     bookings_select_technician, and as the read policies of flight_updates).
-- A flight that nobody may see is not an error: the read returns no row, so another partner's flight is "not found"
-- and nothing about it is revealed (E7). The insert and update policies are not changed: only an admin and an
-- operations manager write flights (the refresh job writes through apply_flight_refresh()).
--
-- Two bookings of different partners on the same flight (same number, airport and scheduled time) share one flight
-- row; each of them sees that row, and nothing of the other booking.
--
-- Functions that read flights as the caller (board_flight_alert) follow the policies: they see the flight of the
-- bookings the caller may see. The deadline functions are SECURITY DEFINER and are not affected.
-- bookings_flight_id_idx (bookings.flight_id) serves the lookup of these policies.
--
-- Rollback:
--   drop policy "flights_select_technician" on public.flights;
--   drop policy "flights_select_partner_user" on public.flights;
--   drop policy "flights_select_admin_ops_manager" on public.flights;
--   create policy "flights_select_authenticated" on public.flights for select to authenticated using (true);

drop policy "flights_select_authenticated" on public.flights;

create policy "flights_select_admin_ops_manager"
  on public.flights for select
  to authenticated
  using ((select public.is_admin_or_ops_manager()));

create policy "flights_select_technician"
  on public.flights for select
  to authenticated
  using (
    exists (
      select 1
      from public.bookings b
      where b.flight_id = flights.id
        and (
          b.assigned_technician_id = (select auth.uid())
          or exists (
            select 1
            from public.technician_jobs tj
            where tj.booking_id = b.id
              and tj.technician_id = (select auth.uid())
          )
        )
    )
  );

create policy "flights_select_partner_user"
  on public.flights for select
  to authenticated
  using (
    exists (
      select 1
      from public.bookings b
      where b.flight_id = flights.id
        and b.partner_id = (select public.current_user_partner_id())
    )
  );
