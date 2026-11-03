import { describe, expect, it } from "vitest";

import {
  AIRPORT,
  USER,
  available,
  bookingId,
  newBooking,
  newPartner,
  run,
} from "@/lib/finance/finance-test-support";

/**
 * CO-F08-T01 (AC03, AC04, AC07, AC11): the computed columns the Workflow Board reads. Every scenario
 * runs in a transaction that is rolled back and makes its own partner, booking and flight. Skipped
 * when the local stack is not running, like the RLS suite.
 */
const FUTURE = "2030-01-10 12:00:00+00";
const RETURN = "2030-01-14 12:00:00+00";
const PARTNER_USER = USER("partner_user");

const flightId = (n: number) => `d5300000-0000-0000-0000-${String(n).padStart(12, "0")}`;

/** A flight due at 11:00 with the given estimate, linked to booking `n` (set as the owner). */
const withFlight = (n: number, estimated: string | null, delay = "null") => `
  insert into public.flights (id, flight_number, airport_id, scheduled_arrival_at, estimated_arrival_at, delay_minutes)
  values ('${flightId(n)}', 'TT ${n}', '${AIRPORT}', '2030-01-10 11:00:00+00', ${estimated ? `'${estimated}'` : "null"}, ${delay});
  update public.bookings set flight_id = '${flightId(n)}' where id = '${bookingId(n)}';`;

/** Reports the three computed columns of booking `n` as `R|name|alert|priority`. */
const reads = (name: string, n: number) => `
  do $$ declare r record; begin
    select public.board_flight_alert(b) as alert, public.board_priority(b) as priority
      into r from public.bookings b where b.id = '${bookingId(n)}';
    raise notice 'R|${name}|%|%', coalesce(r.alert, ''), r.priority;
  end $$;`;

const result = (rows: string[][], name: string) => rows.find((row) => row[0] === name)?.slice(1).join("|");

describe.skipIf(!available)("workflow board reads (CO-F08-T01)", () => {
  it("should call a flight 50 minutes late delayed and the booking high priority (AC04, AC07)", () => {
    const rows = run(`
      ${newPartner(1)}
      ${newBooking(1, 1, RETURN, "90", FUTURE)}
      ${withFlight(1, "2030-01-10 11:50:00+00")}
      ${reads("late", 1)}`);

    expect(result(rows, "late")).toBe("delayed|high");
  });

  it("should call a flight 45 minutes early early (AC04)", () => {
    const rows = run(`
      ${newPartner(2)}
      ${newBooking(2, 2, RETURN, "90", FUTURE)}
      ${withFlight(2, "2030-01-10 10:15:00+00")}
      ${reads("early", 2)}`);

    expect(result(rows, "early")).toBe("early|high");
  });

  it("should give no alert for a flight less than 15 minutes off or for a booking with no flight", () => {
    const rows = run(`
      ${newPartner(3)}
      ${newBooking(3, 3, RETURN, "90", FUTURE)}
      ${withFlight(3, "2030-01-10 11:10:00+00")}
      ${newBooking(4, 3, RETURN, "90", FUTURE)}
      ${reads("close", 3)}
      ${reads("none", 4)}`);

    expect(result(rows, "close")).toBe("|normal");
    expect(result(rows, "none")).toBe("|normal");
  });

  it("should use the stored delay only when the flight has no estimate", () => {
    const rows = run(`
      ${newPartner(5)}
      ${newBooking(5, 5, RETURN, "90", FUTURE)}
      ${withFlight(5, null, "30")}
      ${reads("stored", 5)}`);

    expect(result(rows, "stored")).toBe("delayed|high");
  });

  it("should give the time of the creation event as the time the booking reached its step (AC03)", () => {
    const rows = run(`
      ${newPartner(6)}
      ${newBooking(6, 6, RETURN, "90", FUTURE)}
      do $$ declare s timestamptz; e timestamptz; begin
        select public.board_step_since(b) into s from public.bookings b where b.id = '${bookingId(6)}';
        select max(created_at) into e from public.booking_events
         where booking_id = '${bookingId(6)}' and metadata ->> 'event_type' in ('created', 'status_changed');
        raise notice 'R|since|%', s is not distinct from e;
      end $$;`);

    expect(result(rows, "since")).toBe("true");
  });

  it("should show a partner user no row of another partner's booking through the computed columns (AC11)", () => {
    const rows = run(`
      ${newPartner(7)}
      ${newBooking(7, 7, RETURN, "90", FUTURE)}
      select set_config('request.jwt.claim.sub', coalesce(${PARTNER_USER}, ''), true);
      set local role authenticated;
      do $$ declare n integer; begin
        select count(*) into n from public.bookings b
         where b.id = '${bookingId(7)}' and public.board_step_since(b) is not null;
        raise notice 'R|hidden|%', n;
      end $$;`);

    expect(result(rows, "hidden")).toBe("0");
  });

  it("should not let a signed-out client call the functions", () => {
    const rows = run(`
      ${newPartner(8)}
      ${newBooking(8, 8, RETURN, "90", FUTURE)}
      set local role anon;
      do $$ begin
        perform public.board_priority(b) from public.bookings b limit 1;
        raise notice 'R|anon|ok';
      exception when others then raise notice 'R|anon|%', sqlstate; end $$;`);

    expect(result(rows, "anon")).toBe("42501");
  });
});
