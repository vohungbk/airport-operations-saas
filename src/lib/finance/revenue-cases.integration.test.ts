import { describe, expect, it } from "vitest";

import {
  FLAG_ON,
  available,
  bookingId,
  newBooking,
  newPartner,
  newTerms,
  run,
} from "@/lib/finance/finance-test-support";

/**
 * VI-F04-S07 (spec R14): a booking that ends early, is cancelled or is a no-show is priced by the
 * rule of its case, and the case is kept on the booking. The rule for a cancellation and a no-show
 * (not charged) is an assumption while spec Q3 is open. Runs against the local database; every
 * scenario is inside a transaction that is rolled back and makes its own partner. Skipped when the
 * local stack is not running, like the RLS suite.
 */
const START = "2030-01-01 10:00:00+00";
const FIVE_DAYS = "2030-01-06 10:00:00+00";

/** Reports the revenue fields of a booking as `R|name|case|paid|rental|gross|partner|platform|flag|terms|credit`. */
const state = (name: string, n: number) => `
  do $$ declare b record; begin
    select * into b from public.bookings where id = '${bookingId(n)}';
    raise notice 'R|${name}|%|%|%|%|%|%|%|%|%', coalesce(b.revenue_case, 'null'), b.paid_days,
      coalesce(b.rental_days::text, 'null'), coalesce(b.gross_revenue::text, 'null'),
      coalesce(b.partner_share::text, 'null'), coalesce(b.platform_share::text, 'null'),
      coalesce(b.revenue_flag, 'null'), coalesce(b.commercial_terms_id::text, 'null'), b.launch_credit;
  end $$;`;

/** The operations manager changes the status, through the booking function. */
const ASOPS = `select set_config('request.jwt.claim.sub',
  (select id::text from public.users where role = 'operations_manager' and is_active limit 1), true);`;

const get = (rows: string[][], name: string) => {
  const row = rows.find((r) => r[0] === name);
  expect(row, name).toBeDefined();
  return row!.slice(1);
};

/** Completes a booking, with a real return time or none. */
const completeAt = (n: number, actual: string | null) => `${FLAG_ON}
  update public.bookings set status = 'completed'${actual ? `, actual_return_at = '${actual}'` : ""}
   where id = '${bookingId(n)}';`;

describe.skipIf(!available)("early return, cancellation and no-show (VI-F04-S07, spec R14)", () => {
  const setup = (partner: number, target = "null") => `
    ${newPartner(partner)}
    ${newTerms(partner, partner, 30, "date '2020-01-01'", "null", 50, target)}`;

  it("should not charge a cancelled booking, and keep the case (AC01)", () => {
    const rows = run(`
      ${setup(1)}
      ${newBooking(1, 1, FIVE_DAYS, "90")}
      ${ASOPS}
      select public.change_booking_status('${bookingId(1)}', 'cancelled', 'The customer cancelled');
      ${state("cancelled", 1)}`);

    expect(get(rows, "cancelled")).toEqual(["cancelled", "0", "null", "0.00", "0.00", "0.00", "null", "null", "0.00"]);
  });

  it("should not charge a no-show, and keep the case (AC01)", () => {
    const rows = run(`
      ${setup(2)}
      ${newBooking(2, 2, FIVE_DAYS, "90")}
      ${ASOPS}
      select public.change_booking_status('${bookingId(2)}', 'confirmed');
      select public.change_booking_status('${bookingId(2)}', 'no_show', 'The customer did not come');
      ${state("noshow", 2)}`);

    expect(get(rows, "noshow")).toEqual(["no_show", "0", "null", "0.00", "0.00", "0.00", "null", "null", "0.00"]);
  });

  it("should leave a booking that is still pending or confirmed without a case", () => {
    const rows = run(`
      ${setup(3)}
      ${newBooking(3, 3, FIVE_DAYS, "90")}
      ${ASOPS}
      ${state("pending", 3)}
      select public.change_booking_status('${bookingId(3)}', 'confirmed');
      ${state("confirmed", 3)}`);

    expect(get(rows, "pending")[0]).toBe("null");
    expect(get(rows, "confirmed")[0]).toBe("null");
  });

  it("should charge a rental returned early only for the time it lasted, up to 6 days (AC01)", () => {
    // Booked for five days, returned after two days and one hour: three days at 90.
    const rows = run(`
      ${setup(4)}
      ${newBooking(4, 4, FIVE_DAYS, "90")}
      ${completeAt(4, "2030-01-03 11:00:00+00")}
      ${state("early", 4)}`);

    expect(get(rows, "early").slice(0, 5)).toEqual(["early_return", "3", "3", "270.00", "81.00"]);
  });

  it("should charge a rental returned on the day it was due as a standard one", () => {
    const rows = run(`
      ${setup(5)}
      ${newBooking(5, 5, FIVE_DAYS, "90")}
      ${completeAt(5, FIVE_DAYS)}
      ${state("ontime", 5)}`);

    expect(get(rows, "ontime").slice(0, 4)).toEqual(["standard", "5", "5", "450.00"]);
  });

  it("should charge a rental with no return time for the time it was booked", () => {
    const rows = run(`
      ${setup(6)}
      ${newBooking(6, 6, FIVE_DAYS, "90")}
      ${completeAt(6, null)}
      ${state("noreturn", 6)}`);

    expect(get(rows, "noreturn").slice(0, 4)).toEqual(["standard", "5", "5", "450.00"]);
  });

  it("should charge a late return for the time it really lasted, still up to 6 days", () => {
    const rows = run(`
      ${setup(7)}
      ${newBooking(7, 7, FIVE_DAYS, "90")}
      ${completeAt(7, "2030-01-09 10:00:00+00")}
      ${state("late", 7)}`);

    // Eight days really: 8 rental days, 6 paid, 540.00.
    expect(get(rows, "late").slice(0, 4)).toEqual(["standard", "6", "8", "540.00"]);
  });

  it("should flag a rental returned at the moment of the pickup and not charge it (spec E2)", () => {
    const rows = run(`
      ${setup(8)}
      ${newBooking(8, 8, FIVE_DAYS, "90")}
      ${completeAt(8, START)}
      ${state("zero", 8)}`);

    expect(get(rows, "zero")).toEqual(["early_return", "0", "0", "null", "null", "null", "invalid_duration", "null", "0.00"]);
  });

  it("should calculate again when the real return time of a completed rental changes", () => {
    const rows = run(`
      ${setup(9)}
      ${newBooking(9, 9, FIVE_DAYS, "90")}
      ${completeAt(9, "2030-01-03 11:00:00+00")}
      ${state("first", 9)}
      ${FLAG_ON}
      update public.bookings set actual_return_at = '2030-01-04 11:00:00+00' where id = '${bookingId(9)}';
      ${state("again", 9)}`);

    expect(get(rows, "first").slice(0, 4)).toEqual(["early_return", "3", "3", "270.00"]);
    expect(get(rows, "again").slice(0, 4)).toEqual(["early_return", "4", "4", "360.00"]);
  });

  it("should share an early return with the partner as any other rental, from the terms in force", () => {
    const rows = run(`
      ${setup(10)}
      ${newBooking(10, 10, FIVE_DAYS, "90")}
      ${completeAt(10, "2030-01-03 11:00:00+00")}
      ${state("share", 10)}`);

    const [, , , gross, partner, platform] = get(rows, "share");
    expect([gross, partner, platform]).toEqual(["270.00", "81.00", "189.00"]);
  });

  it("should not touch the launch credit of the partner when a booking is cancelled or a no-show", () => {
    const rows = run(`
      ${setup(11, "1000")}
      ${newBooking(11, 11, "2030-01-04 10:00:00+00", "90")}
      ${completeAt(11, null)}
      ${newBooking(12, 11, FIVE_DAYS, "90")}
      ${ASOPS}
      select public.change_booking_status('${bookingId(12)}', 'cancelled', 'The customer cancelled');
      ${newBooking(13, 11, "2030-01-04 10:00:00+00", "90")}
      ${completeAt(13, null)}
      do $$ declare b record; begin
        select * into b from public.bookings where id = '${bookingId(13)}';
        raise notice 'R|third|%|%', b.launch_credit, b.launch_credit_balance;
      end $$;`);

    // Two completed rentals of 54.00 credit each; the cancelled one adds nothing.
    expect(get(rows, "third")).toEqual(["54.00", "108.00"]);
  });

  it("should not let anyone change the case or the real return time outside the booking functions (55000)", () => {
    const rows = run(`
      ${setup(14)}
      ${newBooking(14, 14, FIVE_DAYS, "90")}
      do $$ declare c text; begin
        foreach c in array array['revenue_case = ''no_show''', 'actual_return_at = ''2030-01-02 10:00:00+00'''] loop
          begin
            execute format('update public.bookings set %s where id = %L', c, '${bookingId(14)}');
            raise notice 'R|%|allowed', c;
          exception when others then
            raise notice 'R|%|%', c, sqlstate;
          end;
        end loop;
      end $$;`);

    expect(rows.map((r) => r[1])).toEqual(["55000", "55000"]);
  });

  it("should give the rule of a case from one function, and refuse a case it has no rule for", () => {
    const rows = run(`
      do $$ declare a record; begin
        select * into a from public.booking_case_revenue('cancelled');
        raise notice 'R|cancelled|%|%', a.paid_days, a.gross_revenue;
        select * into a from public.booking_case_revenue('no_show');
        raise notice 'R|noshow|%|%', a.paid_days, a.gross_revenue;
        begin
          select * into a from public.booking_case_revenue('standard');
          raise notice 'R|standard|allowed';
        exception when others then
          raise notice 'R|standard|%', sqlstate;
        end;
      end $$;`);

    expect(get(rows, "cancelled")).toEqual(["0", "0.00"]);
    expect(get(rows, "noshow")).toEqual(["0", "0.00"]);
    expect(get(rows, "standard")).toEqual(["22023"]);
  });
});
