import { describe, expect, it } from "vitest";

import {
  FLAG_ON,
  adjust,
  adjustmentSetup as setup,
  asUser,
  available,
  bookingId,
  completeBooking,
  newBooking,
  partnerId,
  run,
} from "@/lib/finance/finance-test-support";

/**
 * VI-F04-S12 (spec R7, F10, V10): the admin generates a draft settlement for a partner and a month
 * from the completed rentals of that month. The rentals are of six days at 75, so 450.00 gross; the
 * terms are 30 percent for the partner. Every scenario runs in a transaction that is rolled back.
 * Skipped when the local stack is not running, like the RLS suite.
 */
const JAN = (day: number) => `2026-01-${String(day).padStart(2, "0")} 10:00:00+00`;

/** A completed rental that was due on `ret`, six days after its pickup. */
const rental = (n: number, partner: number, ret: string, pickup: string) => `
  ${newBooking(n, partner, ret, "75", pickup)}
  ${completeBooking(n)}`;

/** Generates a settlement and reports `R|name|ok` or `R|name|<sqlstate>`. */
const generate = (name: string, partner: number | null, month: string | null) => `
  do $$ begin
    perform public.generate_monthly_settlement(${partner === null ? "null" : `'${partnerId(partner)}'`}, ${month === null ? "null" : `date '${month}'`});
    raise notice 'R|${name}|ok';
  exception when others then
    raise notice 'R|${name}|%', sqlstate;
  end $$;`;

/** Reports `R|name|rows|start|end|gross|partner|platform|refunds|adjustments|chargebacks|credit|fees|final|status`. */
const settlement = (name: string, partner: number) => `
  do $$ declare s record; c integer; begin
    select count(*) into c from public.settlements where partner_id = '${partnerId(partner)}';
    select * into s from public.settlements where partner_id = '${partnerId(partner)}' order by period_start limit 1;
    raise notice 'R|${name}|%|%|%|%|%|%|%|%|%|%|%|%|%', c, s.period_start, s.period_end, s.gross_revenue,
      s.partner_share, s.platform_share, s.refunds, s.adjustments, s.chargebacks, s.launch_credit,
      s.fees, s.final_amount, s.status;
  end $$;`;

const get = (rows: string[][], name: string) => {
  const row = rows.find((r) => r[0] === name);
  expect(row, name).toBeDefined();
  return row!.slice(1);
};

describe.skipIf(!available)("monthly settlement (VI-F04-S12, spec R7, F10, V10)", () => {
  it("should create a draft from the completed rentals of the month, with every figure (AC05)", () => {
    const rows = run(`
      ${setup(1)}
      ${rental(1, 1, JAN(7), JAN(1))}
      ${rental(2, 1, JAN(20), JAN(14))}
      ${asUser("operations_manager")}
      ${adjust("r", 1, "'partial_refund'", "100", "'Refund'")}
      ${adjust("c", 2, "'chargeback'", "50", "'Chargeback'")}
      ${adjust("m", 2, "'manual_adjustment'", "10", "'Manual'")}
      ${asUser("admin")}
      ${generate("g", 1, "2026-01-01")}
      ${settlement("s", 1)}`);

    expect(get(rows, "g")).toEqual(["ok"]);
    // 350.00 + 390.00 = 740.00 gross; 30 percent to the partner on each rental, rounded to the cent.
    expect(get(rows, "s")).toEqual([
      "1", "2026-01-01", "2026-01-31", "740.00", "222.00", "518.00", "100.00", "10.00", "50.00",
      "0.00", "0.00", "222.00", "draft",
    ]);
  });

  it("should save the whole month whichever day of the month is given (AC01)", () => {
    const rows = run(`
      ${setup(2)} ${rental(1, 2, JAN(7), JAN(1))}
      ${asUser("admin")}
      ${generate("g", 2, "2026-01-19")}
      ${settlement("s", 2)}`);

    expect(get(rows, "s").slice(0, 3)).toEqual(["1", "2026-01-01", "2026-01-31"]);
  });

  it("should show the launch credit but not add it again to the amount to pay (R7)", () => {
    const rows = run(`
      ${setup(3, { target: "1000", launch: 50 })} ${rental(1, 3, JAN(7), JAN(1))}
      ${asUser("admin")}
      ${generate("g", 3, "2026-01-01")}
      ${settlement("s", 3)}`);

    // 450.00 gross, 50 percent launch share = 225.00; the standard 135.00 leaves 90.00 of credit.
    expect(get(rows, "s").slice(3, 12)).toEqual(["450.00", "225.00", "225.00", "0.00", "0.00", "0.00", "90.00", "0.00", "225.00"]);
  });

  it("should leave out a rental of another month and a rental of another partner (AC05)", () => {
    const rows = run(`
      ${setup(4)} ${setup(5)}
      ${rental(1, 4, JAN(7), JAN(1))}
      ${rental(2, 4, "2026-02-07 10:00:00+00", "2026-02-01 10:00:00+00")}
      ${rental(3, 5, JAN(7), JAN(1))}
      ${asUser("admin")}
      ${generate("g", 4, "2026-01-01")}
      ${settlement("s", 4)}`);

    expect(get(rows, "s").slice(3, 6)).toEqual(["450.00", "135.00", "315.00"]);
  });

  it("should put a rental in the month it was really returned, not the month it was due", () => {
    const rows = run(`
      ${setup(6)}
      ${newBooking(1, 6, "2026-01-31 10:00:00+00", "75", "2026-01-25 10:00:00+00")}
      ${FLAG_ON}
      update public.bookings set actual_return_at = '2026-02-01 08:00:00+00', status = 'completed' where id = '${bookingId(1)}';
      ${asUser("admin")}
      ${generate("jan", 6, "2026-01-01")}
      ${generate("feb", 6, "2026-02-01")}`);

    expect(get(rows, "jan")).toEqual(["ST004"]);
    expect(get(rows, "feb")).toEqual(["ok"]);
  });

  it("should not count a booking that is not completed", () => {
    const rows = run(`
      ${setup(7)}
      ${newBooking(1, 7, JAN(7), "75", JAN(1))}
      ${asUser("admin")}
      ${generate("g", 7, "2026-01-01")}`);

    expect(get(rows, "g")).toEqual(["ST004"]);
  });

  it("should refuse a month in the future with ST002 and save nothing (AC04, V10)", () => {
    const rows = run(`
      ${setup(8)} ${rental(1, 8, JAN(7), JAN(1))}
      ${asUser("admin")}
      ${generate("g", 8, "2099-01-01")}
      ${settlement("s", 8)}`);

    expect(get(rows, "g")).toEqual(["ST002"]);
    expect(get(rows, "s")[0]).toBe("0");
  });

  it("should refuse a missing month or partner with 22023 and an unknown partner with P0002 (AC04)", () => {
    const rows = run(`
      ${setup(9)}
      ${asUser("admin")}
      ${generate("month", 9, null)}
      ${generate("partner", null, "2026-01-01")}
      ${generate("unknown", 99, "2026-01-01")}`);

    expect(get(rows, "month")).toEqual(["22023"]);
    expect(get(rows, "partner")).toEqual(["22023"]);
    expect(get(rows, "unknown")).toEqual(["P0002"]);
  });

  it("should refuse a second settlement for the same partner and month with ST003", () => {
    const rows = run(`
      ${setup(10)} ${rental(1, 10, JAN(7), JAN(1))}
      ${asUser("admin")}
      ${generate("first", 10, "2026-01-01")}
      ${generate("second", 10, "2026-01-30")}
      ${settlement("s", 10)}`);

    expect(get(rows, "first")).toEqual(["ok"]);
    expect(get(rows, "second")).toEqual(["ST003"]);
    expect(get(rows, "s")[0]).toBe("1");
  });

  it("should refuse a month with no completed rental with ST004 and not save an empty draft", () => {
    const rows = run(`
      ${setup(11)}
      ${asUser("admin")}
      ${generate("g", 11, "2026-01-01")}
      ${settlement("s", 11)}`);

    expect(get(rows, "g")).toEqual(["ST004"]);
    expect(get(rows, "s")[0]).toBe("0");
  });

  it.each([
    ["an operations manager", "operations_manager"],
    ["a technician", "technician"],
    ["a partner user", "partner_user"],
    ["nobody signed in", null],
  ])("should refuse %s with 42501 and save nothing (AC02)", (_name, role) => {
    const rows = run(`
      ${setup(12)} ${rental(1, 12, JAN(7), JAN(1))}
      ${asUser(role)}
      ${generate("g", 12, "2026-01-01")}
      ${settlement("s", 12)}`);

    expect(get(rows, "g")).toEqual(["42501"]);
    expect(get(rows, "s")[0]).toBe("0");
  });
});
