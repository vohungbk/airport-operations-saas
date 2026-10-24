import { describe, expect, it } from "vitest";

import { dbContainer, runSql } from "@/lib/db-test-support";

/**
 * VI-F04-S04 (spec R10, E1, E2): when a rental is completed, paid days = the smaller of the
 * actual rental days and 6, and gross revenue = paid days x the daily rate; the actual duration
 * is kept. A rental with no duration is flagged and not charged. Runs against the local
 * database; every statement is made inside a transaction that is rolled back, so nothing is left
 * behind. Skipped when the local stack is not running, like the RLS suite.
 *
 * Nothing in the app sets a booking to completed yet (the return chain does, F14 and F15), so
 * the tests do it the way the booking functions do: with the flag `app.booking_change`.
 */
const available = dbContainer() !== null && runSql("select 1;")?.ok === true;

const PARTNER = "b0000000-0000-0000-0000-000000000001";
const AIRPORT = "a0000000-0000-0000-0000-000000000001";
const CATEGORY = "c0000000-0000-0000-0000-000000000001";

/** Runs a script in a transaction that is rolled back, and returns its `R|...` notices. */
function run(script: string): string[][] {
  const result = runSql(`begin;\n${script}\nrollback;`);
  if (!result?.ok) throw new Error(result?.output ?? "docker is not available");
  return result.output
    .split("\n")
    .map((line) => /R\|(.*)$/.exec(line)?.[1])
    .filter((row): row is string => row !== undefined)
    .map((row) => row.split("|"));
}

const insertBooking = (id: string, pickup: string, ret: string, rate: string) =>
  `insert into public.bookings (id, booking_number, partner_id, airport_id, pickup_at, return_at, seat_category_id, daily_rate)
   values ('${id}', 'PD-${id.slice(-4)}', '${PARTNER}', '${AIRPORT}', '${pickup}', '${ret}', '${CATEGORY}', ${rate});`;

const FLAG_ON = `select set_config('app.booking_change', 'on', true);`;

/** Inserts a booking, completes it, and reports what the rule wrote. */
const complete = (name: string, id: string, pickup: string, ret: string, rate: string) => `
  ${insertBooking(id, pickup, ret, rate)}
  ${FLAG_ON}
  update public.bookings set status = 'completed' where id = '${id}';
  do $$ declare b record; begin
    select * into b from public.bookings where id = '${id}';
    raise notice 'R|${name}|%|%|%|%|%|%', b.rental_days, b.paid_days, coalesce(b.gross_revenue::text, 'null'),
      coalesce(b.revenue_flag, 'null'), b.pickup_at, b.return_at;
  end $$;`;

interface Case {
  name: string;
  pickup: string;
  ret: string;
  rate: string;
  rentalDays: string;
  paidDays: string;
  gross: string;
  flag: string;
}

const T0 = "2030-01-01 10:00:00+00";
const at = (pickup: string, ret: string, rate = "75") => ({ pickup, ret, rate });

const CASES: Case[] = [
  { name: "one hour", ...at(T0, "2030-01-01 11:00:00+00"), rentalDays: "1", paidDays: "1", gross: "75.00", flag: "null" },
  { name: "exactly 24 hours", ...at(T0, "2030-01-02 10:00:00+00"), rentalDays: "1", paidDays: "1", gross: "75.00", flag: "null" },
  { name: "24 hours and 1 second", ...at(T0, "2030-01-02 10:00:01+00"), rentalDays: "2", paidDays: "2", gross: "150.00", flag: "null" },
  { name: "three days", ...at(T0, "2030-01-04 10:00:00+00"), rentalDays: "3", paidDays: "3", gross: "225.00", flag: "null" },
  { name: "exactly six days", ...at(T0, "2030-01-07 10:00:00+00"), rentalDays: "6", paidDays: "6", gross: "450.00", flag: "null" },
  { name: "six days and one minute", ...at(T0, "2030-01-07 10:01:00+00"), rentalDays: "7", paidDays: "6", gross: "450.00", flag: "null" },
  { name: "seven days", ...at(T0, "2030-01-08 10:00:00+00"), rentalDays: "7", paidDays: "6", gross: "450.00", flag: "null" },
  { name: "thirty days", ...at(T0, "2030-01-31 10:00:00+00"), rentalDays: "30", paidDays: "6", gross: "450.00", flag: "null" },
  { name: "exact money", ...at(T0, "2030-01-08 10:00:00+00", "33.33"), rentalDays: "7", paidDays: "6", gross: "199.98", flag: "null" },
  { name: "a rate of zero", ...at(T0, "2030-01-04 10:00:00+00", "0"), rentalDays: "3", paidDays: "3", gross: "0.00", flag: "null" },
  { name: "no duration", ...at(T0, T0), rentalDays: "0", paidDays: "0", gross: "null", flag: "invalid_duration" },
  // The same instants written in other time zones count the same days: the rule is elapsed time.
  // 23:00 at -08 is 07:00 UTC, so this is exactly 24 hours (1 day), and one second more is 2.
  { name: "other time zones", ...at("2030-01-01 23:00:00-08", "2030-01-03 07:00:00+00"), rentalDays: "1", paidDays: "1", gross: "75.00", flag: "null" },
  { name: "other time zones, a second more", ...at("2030-01-01 23:00:00-08", "2030-01-03 07:00:01+00"), rentalDays: "2", paidDays: "2", gross: "150.00", flag: "null" },
];

const idOf = (n: number) => `d4000000-0000-0000-0000-${String(n).padStart(12, "0")}`;

describe.skipIf(!available)("paid days are capped at six (VI-F04-S04, spec R10, E1, E2)", () => {
  const rows = available
    ? run(CASES.map((c, i) => complete(c.name, idOf(i + 1), c.pickup, c.ret, c.rate)).join("\n"))
    : [];

  it.each(CASES.map((c) => [c.name, c] as const))(
    "should give the right days and revenue for %s (AC01, AC02, AC03)",
    (name, expected) => {
      const row = rows.find((r) => r[0] === name);

      expect(row, name).toBeDefined();
      const [, rentalDays, paidDays, gross, flag] = row!;
      expect({ rentalDays, paidDays, gross, flag }).toEqual({
        rentalDays: expected.rentalDays,
        paidDays: expected.paidDays,
        gross: expected.gross,
        flag: expected.flag,
      });
    },
  );

  it("should keep the actual duration: the pickup and the return are not changed (AC01, AC02)", () => {
    const [, , , , , pickup, ret] = rows.find((r) => r[0] === "thirty days")!;

    expect(new Date(pickup).toISOString()).toBe("2030-01-01T10:00:00.000Z");
    expect(new Date(ret).toISOString()).toBe("2030-01-31T10:00:00.000Z");
  });

  it("should never charge more than six days, whatever the length", () => {
    for (const row of rows) {
      expect(Number(row[2]), row[0]).toBeLessThanOrEqual(6);
    }
  });

  it("should keep rental days above the cap for a long rental, and paid days at the cap (AC02)", () => {
    const [, rentalDays, paidDays] = rows.find((r) => r[0] === "thirty days")!;

    expect(Number(rentalDays)).toBeGreaterThan(Number(paidDays));
  });

  it("should write nothing for a booking that is not completed", () => {
    const [[, rentalDays, paidDays, gross, flag]] = run(`
      ${insertBooking(idOf(50), T0, "2030-01-10 10:00:00+00", "75")}
      ${FLAG_ON}
      update public.bookings set status = 'confirmed' where id = '${idOf(50)}';
      do $$ declare b record; begin
        select * into b from public.bookings where id = '${idOf(50)}';
        raise notice 'R|pending|%|%|%|%', coalesce(b.rental_days::text, 'null'), b.paid_days,
          coalesce(b.gross_revenue::text, 'null'), coalesce(b.revenue_flag, 'null');
      end $$;`).map((r) => r.slice(0));

    expect([rentalDays, paidDays, gross, flag]).toEqual(["null", "0", "null", "null"]);
  });

  it("should calculate again, and clear the flag, when the period of a completed rental is corrected (AC03)", () => {
    const rowsOut = run(`
      ${complete("flagged", idOf(60), T0, T0, "75")}
      update public.bookings set return_at = '2030-01-03 10:00:00+00' where id = '${idOf(60)}';
      do $$ declare b record; begin
        select * into b from public.bookings where id = '${idOf(60)}';
        raise notice 'R|corrected|%|%|%|%', b.rental_days, b.paid_days, coalesce(b.gross_revenue::text, 'null'),
          coalesce(b.revenue_flag, 'null');
      end $$;`);

    expect(rowsOut.find((r) => r[0] === "flagged")!.slice(1, 5)).toEqual(["0", "0", "null", "invalid_duration"]);
    expect(rowsOut.find((r) => r[0] === "corrected")!.slice(1)).toEqual(["2", "2", "150.00", "null"]);
  });

  it("should calculate the gross again when the daily rate of a completed rental changes", () => {
    const rowsOut = run(`
      ${complete("first", idOf(70), T0, "2030-01-04 10:00:00+00", "75")}
      update public.bookings set daily_rate = 100 where id = '${idOf(70)}';
      do $$ declare b record; begin
        select * into b from public.bookings where id = '${idOf(70)}';
        raise notice 'R|second|%|%|%', b.rental_days, b.paid_days, b.gross_revenue;
      end $$;`);

    expect(rowsOut.find((r) => r[0] === "first")![3]).toBe("225.00");
    expect(rowsOut.find((r) => r[0] === "second")!.slice(1)).toEqual(["3", "3", "300.00"]);
  });

  it("should not let anyone change the finance fields outside the booking functions (55000)", () => {
    const rowsOut = run(`
      ${complete("base", idOf(80), T0, "2030-01-04 10:00:00+00", "75")}
      select set_config('app.booking_change', '', true);
      do $$ declare c text; begin
        foreach c in array array['paid_days = 1', 'rental_days = 1', 'revenue_flag = ''invalid_duration''', 'gross_revenue = 1'] loop
          begin
            execute format('update public.bookings set %s where id = %L', c, '${idOf(80)}');
            raise notice 'R|%|allowed', c;
          exception when others then
            raise notice 'R|%|%', c, sqlstate;
          end;
        end loop;
      end $$;`).filter((r) => r[0] !== "base");

    expect(rowsOut).toEqual([
      ["paid_days = 1", "55000"],
      ["rental_days = 1", "55000"],
      ["revenue_flag = 'invalid_duration'", "55000"],
      ["gross_revenue = 1", "55000"],
    ]);
  });

  it("should refuse more than six paid days, and a negative count or an unknown flag, in the table", () => {
    const out = run(`
      ${insertBooking(idOf(90), T0, "2030-01-02 10:00:00+00", "75")}
      ${FLAG_ON}
      do $$ declare c text; begin
        foreach c in array array['paid_days = 7', 'rental_days = -1', 'revenue_flag = ''other'''] loop
          begin
            execute format('update public.bookings set %s where id = %L', c, '${idOf(90)}');
            raise notice 'R|%|allowed', c;
          exception when check_violation then
            raise notice 'R|%|refused', c;
          end;
        end loop;
      end $$;`);

    expect(out).toEqual([
      ["paid_days = 7", "refused"],
      ["rental_days = -1", "refused"],
      ["revenue_flag = 'other'", "refused"],
    ]);
  });

  // The flow of the feature (spec section 3): the admin sets the terms of a partner, a rental is
  // booked and confirmed by operations, the rental completes, and the paid days are capped.
  it("should work from the terms to a completed rental of ten days: six paid days and the gross (AC04)", () => {
    const out = run(`
      select set_config('request.jwt.claim.sub',
        (select id::text from public.users where role = 'admin' and is_active limit 1), true);
      select public.set_partner_commercial_terms('${PARTNER}', 35, 55, current_date + 4000, null, 0, 0, 0, 14);

      select set_config('request.jwt.claim.sub',
        (select id::text from public.users where role = 'operations_manager' and is_active limit 1), true);
      do $$ declare v_booking public.bookings; begin
        v_booking := public.create_booking(
          p_partner_id => '${PARTNER}', p_airport_id => '${AIRPORT}', p_seat_category_id => '${CATEGORY}',
          p_pickup_at => timestamptz '2031-03-01 08:00+00', p_return_at => timestamptz '2031-03-11 08:00+00',
          p_daily_rate => 40);
        v_booking := public.change_booking_status(v_booking.id, 'confirmed');
        raise notice 'R|confirmed|%|%', v_booking.status, v_booking.paid_days;

        perform set_config('app.booking_change', 'on', true);
        update public.bookings set status = 'completed' where id = v_booking.id
          returning * into v_booking;
        raise notice 'R|completed|%|%|%|%', v_booking.status, v_booking.rental_days, v_booking.paid_days,
          v_booking.gross_revenue;
      end $$;`);

    expect(out.find((r) => r[0] === "confirmed")!.slice(1)).toEqual(["confirmed", "0"]);
    expect(out.find((r) => r[0] === "completed")!.slice(1)).toEqual(["completed", "10", "6", "240.00"]);
  });
});
