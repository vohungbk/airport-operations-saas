import { describe, expect, it } from "vitest";

import { AIRPORT, CATEGORY, FLAG_ON, available, run } from "@/lib/finance/finance-test-support";

/**
 * VI-F04-S05 (spec R11, R17, A1): when a rental is completed, the partner and platform shares are
 * calculated from the terms in force and stored on the booking, and the two add up to the gross
 * revenue. Runs against the local database; every statement is made inside a transaction that is
 * rolled back. Skipped when the local stack is not running, like the RLS suite.
 *
 * Each scenario makes its own partner, so the terms of the demo data do not matter.
 */
const PICKUP = "2030-01-01 10:00:00+00";
const SIX_DAYS_OR_MORE = "2030-01-08 10:00:00+00"; // 7 days: 6 are paid
const THREE_DAYS = "2030-01-04 10:00:00+00";

const partnerId = (n: number) => `d5000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const bookingId = (n: number) => `d5100000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const termsId = (n: number) => `d5200000-0000-0000-0000-${String(n).padStart(12, "0")}`;

const newPartner = (n: number) =>
  `insert into public.partners (id, name, code, contact_email)
   values ('${partnerId(n)}', 'RS partner ${n}', 'RS${n}', 'rs${n}@test.example');`;

/** A version of the terms of a partner; `to` is a SQL expression or `null`. */
const newTerms = (n: number, partner: number, percent: number, from: string, to = "null") =>
  `insert into public.partner_commercial_terms
     (id, partner_id, partner_share_percent, platform_share_percent, launch_partner_share_percent, effective_from, effective_to)
   values ('${termsId(n)}', '${partnerId(partner)}', ${percent}, ${100 - percent}, 100, ${from}, ${to});`;

const newBooking = (n: number, partner: number, ret: string, rate: string, pickup = PICKUP) =>
  `insert into public.bookings (id, booking_number, partner_id, airport_id, pickup_at, return_at, seat_category_id, daily_rate)
   values ('${bookingId(n)}', 'RS-${n}', '${partnerId(partner)}', '${AIRPORT}', '${pickup}', '${ret}', '${CATEGORY}', ${rate});`;

const completeBooking = (n: number) => `${FLAG_ON}
  update public.bookings set status = 'completed' where id = '${bookingId(n)}';`;

/** Reports the revenue fields of a booking as `R|name|paid|gross|partner|platform|flag|terms`. */
const report = (name: string, n: number) => `
  do $$ declare b record; begin
    select * into b from public.bookings where id = '${bookingId(n)}';
    raise notice 'R|${name}|%|%|%|%|%|%', b.paid_days, coalesce(b.gross_revenue::text, 'null'),
      coalesce(b.partner_share::text, 'null'), coalesce(b.platform_share::text, 'null'),
      coalesce(b.revenue_flag, 'null'), coalesce(b.commercial_terms_id::text, 'null');
  end $$;`;

const only = (rows: string[][], name: string) => {
  const row = rows.find((r) => r[0] === name);
  expect(row, name).toBeDefined();
  return row!.slice(1);
};

describe.skipIf(!available)("partner and platform shares of a completed rental (VI-F04-S05, spec R11, R17)", () => {
  it.each([
    ["30 percent of six paid days at 75", 30, SIX_DAYS_OR_MORE, "75", ["6", "450.00", "135.00", "315.00"]],
    ["35.5 percent of three days at 75", 35.5, THREE_DAYS, "75", ["3", "225.00", "79.88", "145.12"]],
    ["0 percent: all to the platform", 0, THREE_DAYS, "75", ["3", "225.00", "0.00", "225.00"]],
    ["100 percent: all to the partner", 100, THREE_DAYS, "75", ["3", "225.00", "225.00", "0.00"]],
    ["a rate of zero", 30, THREE_DAYS, "0", ["3", "0.00", "0.00", "0.00"]],
    ["rounding to the cent: 199.98 at 33.33 percent", 33.33, SIX_DAYS_OR_MORE, "33.33", ["6", "199.98", "66.65", "133.33"]],
  ] as const)("should split %s (AC01, AC02)", (name, percent, ret, rate, expected) => {
    const rows = run(`
      ${newPartner(1)}
      ${newTerms(1, 1, percent, "date '2020-01-01'")}
      ${newBooking(1, 1, ret, rate)}
      ${completeBooking(1)}
      ${report(name, 1)}`);

    const [paid, gross, partner, platform, flag, terms] = only(rows, name);

    expect([paid, gross, partner, platform]).toEqual(expected);
    expect(flag).toBe("null");
    expect(terms).toBe(termsId(1));
    expect(Number(partner) + Number(platform)).toBeCloseTo(Number(gross), 2);
  });

  it("should write the four revenue fields and the terms it used on the booking (AC02)", () => {
    const rows = run(`
      ${newPartner(2)}
      ${newTerms(2, 2, 30, "date '2020-01-01'")}
      ${newBooking(2, 2, SIX_DAYS_OR_MORE, "75")}
      ${report("before", 2)}
      ${completeBooking(2)}
      ${report("after", 2)}`);

    expect(only(rows, "before")).toEqual(["0", "null", "null", "null", "null", "null"]);
    expect(only(rows, "after")).toEqual(["6", "450.00", "135.00", "315.00", "null", termsId(2)]);
  });

  it("should always add up to the gross revenue, to the cent, for any amount and percentage (AC01, AC03)", () => {
    const rows = run(`
      do $$
      declare
        v_gross numeric; v_percent numeric; s record; bad integer := 0; n integer := 0;
      begin
        for i in 1..1000 loop
          v_gross := round((random() * 99999999)::numeric, 2);
          v_percent := round((random() * 100)::numeric, 2);
          select * into s from public.booking_shares(v_gross, v_percent);
          n := n + 1;
          if s.partner_share + s.platform_share <> v_gross or s.partner_share < 0 or s.platform_share < 0
             or s.partner_share <> round(s.partner_share, 2) or s.platform_share <> round(s.platform_share, 2) then
            bad := bad + 1;
          end if;
        end loop;
        raise notice 'R|property|%|%', n, bad;
      end $$;`);

    expect(only(rows, "property")).toEqual(["1000", "0"]);
  });

  it("should use the terms in force on the day of the completion, not an ended or a future version", () => {
    const rows = run(`
      ${newPartner(3)}
      ${newTerms(10, 3, 20, "date '2020-01-01'", "current_date - 1")}
      ${newTerms(11, 3, 40, "current_date")}
      ${newTerms(12, 3, 90, "current_date + 10")}
      ${newBooking(3, 3, SIX_DAYS_OR_MORE, "100")}
      ${completeBooking(3)}
      ${report("version", 3)}`);

    const [, gross, partner, platform, , terms] = only(rows, "version");

    expect({ gross, partner, platform, terms }).toEqual({
      gross: "600.00",
      partner: "240.00",
      platform: "360.00",
      terms: termsId(11),
    });
  });

  it("should keep the terms of a completed rental when it is calculated again after new terms start (E5)", () => {
    const rows = run(`
      ${newPartner(4)}
      ${newTerms(20, 4, 30, "date '2020-01-01'")}
      ${newBooking(4, 4, THREE_DAYS, "100")}
      ${completeBooking(4)}
      ${report("first", 4)}
      update public.partner_commercial_terms set effective_to = current_date - 1 where id = '${termsId(20)}';
      ${newTerms(21, 4, 50, "current_date")}
      update public.bookings set return_at = '2030-01-05 10:00:00+00' where id = '${bookingId(4)}';
      ${report("again", 4)}`);

    expect(only(rows, "first")).toEqual(["3", "300.00", "90.00", "210.00", "null", termsId(20)]);
    expect(only(rows, "again")).toEqual(["4", "400.00", "120.00", "280.00", "null", termsId(20)]);
  });

  it("should give the gross but no shares, and the flag no_terms, to a partner with no terms in force (AC01)", () => {
    const rows = run(`
      ${newPartner(5)}
      ${newTerms(30, 5, 30, "current_date + 5")}
      ${newBooking(5, 5, THREE_DAYS, "100")}
      ${completeBooking(5)}
      ${report("noterms", 5)}`);

    expect(only(rows, "noterms")).toEqual(["3", "300.00", "null", "null", "no_terms", "null"]);
  });

  it("should not share a rental with no duration: no gross, no shares (spec E2)", () => {
    const rows = run(`
      ${newPartner(6)}
      ${newTerms(40, 6, 30, "date '2020-01-01'")}
      ${newBooking(6, 6, PICKUP, "100")}
      ${completeBooking(6)}
      ${report("empty", 6)}`);

    expect(only(rows, "empty")).toEqual(["0", "null", "null", "null", "invalid_duration", "null"]);
  });

  it("should share nothing for a booking that is not completed", () => {
    const rows = run(`
      ${newPartner(7)}
      ${newTerms(50, 7, 30, "date '2020-01-01'")}
      ${newBooking(7, 7, THREE_DAYS, "100")}
      ${FLAG_ON}
      update public.bookings set status = 'confirmed' where id = '${bookingId(7)}';
      ${report("confirmed", 7)}`);

    expect(only(rows, "confirmed")).toEqual(["0", "null", "null", "null", "null", "null"]);
  });

  it("should refuse an amount that is not valid, in the table (AC03)", () => {
    const rows = run(`
      ${newPartner(8)}
      ${newBooking(8, 8, THREE_DAYS, "100")}
      ${FLAG_ON}
      do $$ declare c text; begin
        foreach c in array array[
          'gross_revenue = -1',
          'gross_revenue = 100, partner_share = -1, platform_share = 101',
          'gross_revenue = 100, partner_share = 50',
          'gross_revenue = 100, partner_share = 60, platform_share = 30',
          'partner_share = 10, platform_share = 10'
        ] loop
          begin
            execute format('update public.bookings set %s where id = %L', c, '${bookingId(8)}');
            raise notice 'R|%|allowed', c;
          exception when check_violation then
            raise notice 'R|%|refused', c;
          end;
        end loop;
      end $$;`);

    expect(rows.map((r) => r[1])).toEqual(["refused", "refused", "refused", "refused", "refused"]);
  });

  it("should accept shares that add up to the gross revenue, to the cent", () => {
    const rows = run(`
      ${newPartner(9)}
      ${newBooking(9, 9, THREE_DAYS, "100")}
      ${FLAG_ON}
      update public.bookings set gross_revenue = 100.01, partner_share = 33.34, platform_share = 66.67
       where id = '${bookingId(9)}';
      ${report("ok", 9)}`);

    expect(only(rows, "ok").slice(1, 4)).toEqual(["100.01", "33.34", "66.67"]);
  });

  it("should not let anyone change the shares or the terms of a booking outside the booking functions (55000)", () => {
    const rows = run(`
      ${newPartner(10)}
      ${newTerms(60, 10, 30, "date '2020-01-01'")}
      ${newBooking(10, 10, THREE_DAYS, "100")}
      ${completeBooking(10)}
      select set_config('app.booking_change', '', true);
      do $$ declare c text; begin
        foreach c in array array['partner_share = 1, platform_share = 299', 'commercial_terms_id = null'] loop
          begin
            execute format('update public.bookings set %s where id = %L', c, '${bookingId(10)}');
            raise notice 'R|%|allowed', c;
          exception when others then
            raise notice 'R|%|%', c, sqlstate;
          end;
        end loop;
      end $$;`);

    expect(rows.map((r) => r[1])).toEqual(["55000", "55000"]);
  });

  it("should keep the version of the terms a booking used: it cannot be deleted (23503)", () => {
    const rows = run(`
      ${newPartner(11)}
      ${newTerms(70, 11, 30, "date '2020-01-01'")}
      ${newBooking(11, 11, THREE_DAYS, "100")}
      ${completeBooking(11)}
      do $$ begin
        delete from public.partner_commercial_terms where id = '${termsId(70)}';
        raise notice 'R|delete|allowed';
      exception when foreign_key_violation then
        raise notice 'R|delete|refused';
      end $$;`);

    expect(only(rows, "delete")).toEqual(["refused"]);
  });
});
