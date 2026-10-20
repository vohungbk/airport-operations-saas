-- FO-F05-S08: keep the seat an incident refers to.
--
-- A seat is never deleted by the app: it is retired (status retired, terminal),
-- and every seat has a status history that blocks a delete. incidents.seat_id
-- was still ON DELETE SET NULL, so a delete done by maintenance or a service
-- role would have silently dropped the reference. It is now ON DELETE
-- RESTRICT, like inspection_records, cleaning_records and seat_status_history:
-- deleting a seat that an incident refers to is refused and the reference is
-- kept. booking_id and technician_job_id keep their ON DELETE SET NULL.

alter table public.incidents
  drop constraint incidents_seat_id_fkey,
  add constraint incidents_seat_id_fkey
    foreign key (seat_id) references public.seats(id) on delete restrict;

-- Rollback (run manually against the target database if needed):
-- alter table public.incidents
--   drop constraint incidents_seat_id_fkey,
--   add constraint incidents_seat_id_fkey
--     foreign key (seat_id) references public.seats(id) on delete set null;
