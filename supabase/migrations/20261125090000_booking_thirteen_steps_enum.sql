-- CO-F08 (D4 design): the booking path has 13 steps, not 5.
--
-- The five values of booking_status keep their ids and gain the name the design gives them
-- (the ids are used by the finance, partner and cleaning functions, so they are not renamed):
--   pending      New
--   confirmed    Allocated
--   assigned     Technician Assigned
--   in_progress  Active Rental
--   completed    Available
-- Eight values are added for the steps that had no status:
--   preparation (Preparation), ready (Ready), en_route (En Route), installed (Installed),
--   family_ready (Family Ready), returned (Returned), cleaning (Cleaning), inspection (Inspection).
-- cancelled and no_show are still off the path. Existing rows keep their status and so keep
-- their place on the path. The order of the path is held by booking_step_order(), not by the enum.
--
-- A new value cannot be used in the transaction that adds it, so the functions that use the new
-- values are in the next migration (20261126090000_booking_thirteen_steps_functions.sql).

alter type public.booking_status add value if not exists 'preparation';
alter type public.booking_status add value if not exists 'ready';
alter type public.booking_status add value if not exists 'en_route';
alter type public.booking_status add value if not exists 'installed';
alter type public.booking_status add value if not exists 'family_ready';
alter type public.booking_status add value if not exists 'returned';
alter type public.booking_status add value if not exists 'cleaning';
alter type public.booking_status add value if not exists 'inspection';

-- Rollback: a value cannot be removed from an enum. To undo, restore the functions of
-- 20261126090000_booking_thirteen_steps_functions.sql from their earlier migrations and leave the
-- unused values in the type (no booking may hold them).
