import { describe, expect, it } from "vitest";

import {
  FLAG_ON,
  adjust,
  adjustmentSetup as setup,
  adjustmentState as state,
  asUser,
  available,
  bookingId,
  completeBooking,
  completedRental as completed,
  newBooking,
  run,
} from "@/lib/finance/finance-test-support";

/**
 * VI-F04-S11 (spec R15, E6, E7): after a refund or a chargeback the gross revenue and the shares
 * are calculated again, and a refund larger than the gross revenue, or an amount that is negative or
 * not a number, is refused. The recalculation itself comes with VI-F04-S10; these tests are the proof
 * of each criterion of S11, with real amounts. A rental of six days at 75 is 450.00 gross; the terms
 * are 30 percent for the partner. What a refund does to the launch credit is spec Q4, still open: the
 * credit is not changed, and this file says so in numbers. Every scenario runs in a transaction that
 * is rolled back. Skipped when the local stack is not running, like the RLS suite.
 */
const get = (rows: string[][], name: string) => {
  const row = rows.find((r) => r[0] === name);
  expect(row, name).toBeDefined();
  return row!.slice(1);
};

describe.skipIf(!available)("shares after a refund or a chargeback (VI-F04-S11, spec R15, E6, E7)", () => {
  it.each([
    ["a partial refund", "'partial_refund'"],
    ["a full refund", "'full_refund'"],
    ["a manual adjustment", "'manual_adjustment'"],
    ["a chargeback", "'chargeback'"],
  ])("should calculate the gross revenue and both shares again after %s, adding up (AC01)", (_name, type) => {
    const rows = run(`
      ${setup(1)} ${completed(1, 1)}
      ${asUser("operations_manager")}
      ${adjust("one", 1, type, "100", "'A reason'")}
      ${state("after", 1)}`);

    expect(get(rows, "after").slice(0, 4)).toEqual(["350.00", "105.00", "245.00", "-100.00"]);
  });

  it("should calculate again after each of several adjustments, to the cent, and always add up (AC01)", () => {
    const rows = run(`
      ${setup(2)} ${completed(2, 2)}
      ${asUser("operations_manager")}
      ${adjust("a", 2, "'partial_refund'", "30.33", "'First'")}
      ${state("one", 2)}
      ${adjust("b", 2, "'chargeback'", "12.34", "'Second'")}
      ${adjust("c", 2, "'manual_adjustment'", "5.01", "'Third'")}
      ${state("three", 2)}`);

    // 450.00 - 30.33 = 419.67; the partner gets 30 percent, rounded to the cent.
    expect(get(rows, "one").slice(0, 3)).toEqual(["419.67", "125.90", "293.77"]);
    // 450.00 - 47.68 = 402.32
    expect(get(rows, "three").slice(0, 4)).toEqual(["402.32", "120.70", "281.62", "-47.68"]);
  });

  it("should add up to the gross revenue after every one of many random adjustments (AC01, R17)", () => {
    const rows = run(`
      ${setup(3)} ${completed(3, 3)}
      ${asUser("operations_manager")}
      do $$
      declare
        b record; v_amount numeric; v_bad integer := 0; v_steps integer := 0;
      begin
        for i in 1..60 loop
          select * into b from public.bookings where id = '${bookingId(3)}';
          exit when b.gross_revenue <= 0;
          v_amount := least(round((random() * 25 + 0.01)::numeric, 2), b.gross_revenue);
          perform public.add_booking_adjustment('${bookingId(3)}', 'partial_refund', v_amount, 'Random');
          select * into b from public.bookings where id = '${bookingId(3)}';
          v_steps := v_steps + 1;
          if b.partner_share + b.platform_share <> b.gross_revenue
             or b.gross_revenue <> 450.00 + b.adjustments_total
             or b.partner_share < 0 or b.platform_share < 0 then
            v_bad := v_bad + 1;
          end if;
        end loop;
        raise notice 'R|property|%|%', v_steps, v_bad;
      end $$;`);

    const [steps, bad] = get(rows, "property");
    expect(Number(steps)).toBeGreaterThan(10);
    expect(bad).toBe("0");
  });

  // Spec Q4 is open: does a refund reduce the launch credit already accumulated? It does not, for
  // now. Three days at 90 is 270.00; the standard share is 81.00, the launch share 135.00, so the
  // rental brings 54.00 of credit. After a refund of 70.00 the partner gets the launch share of the
  // 200.00 that is left, 100.00, and the credit and the balance of the partner stay at 54.00.
  it("should not change the launch credit after a refund, and share what is left at the launch share (Q4 assumption)", () => {
    const rows = run(`
      ${setup(4, { target: "1000" })}
      ${newBooking(41, 4, "2030-01-04 10:00:00+00", "90")}
      ${completeBooking(41)}
      ${state("before", 41)}
      ${asUser("operations_manager")}
      ${adjust("refund", 41, "'partial_refund'", "70", "'A refund'")}
      ${state("after", 41)}
      do $$ declare t record; begin
        select * into t from public.partner_commercial_terms where partner_id = '${"d5000000-0000-0000-0000-000000000004"}';
        raise notice 'R|terms|%', t.launch_credit_accumulated;
      end $$;`);

    expect(get(rows, "before")).toEqual(["270.00", "135.00", "135.00", "0.00", "54.00", "54.00", "0"]);
    expect(get(rows, "after")).toEqual(["200.00", "100.00", "100.00", "-70.00", "54.00", "54.00", "1"]);
    expect(get(rows, "terms")).toEqual(["54.00"]);
  });

  it("should leave the next rental of the partner counting the whole credit of the refunded one (Q4 assumption)", () => {
    const rows = run(`
      ${setup(5, { target: "1000" })}
      ${newBooking(51, 5, "2030-01-04 10:00:00+00", "90")}
      ${completeBooking(51)}
      ${asUser("operations_manager")}
      ${adjust("refund", 51, "'full_refund'", "270", "'All of it back'")}
      ${newBooking(52, 5, "2030-01-04 10:00:00+00", "90")}
      ${completeBooking(52)}
      ${state("next", 52)}`);

    // The first rental was refunded in full and still counts 54.00; the next one brings 54.00 more.
    expect(get(rows, "next").slice(4, 6)).toEqual(["54.00", "108.00"]);
  });

  it("should share what is left at the standard share when the partner has no launch terms", () => {
    const rows = run(`
      ${setup(6)} ${completed(6, 6)}
      ${asUser("operations_manager")}
      ${adjust("refund", 6, "'chargeback'", "50", "'The bank took it back'")}
      ${state("after", 6)}`);

    expect(get(rows, "after")).toEqual(["400.00", "120.00", "280.00", "-50.00", "0.00", "null", "1"]);
  });

  it.each([
    ["a partial refund", "'partial_refund'"],
    ["a full refund", "'full_refund'"],
    ["a manual adjustment", "'manual_adjustment'"],
    ["a chargeback", "'chargeback'"],
  ])("should refuse %s larger than the gross revenue that is left, by one cent, and change nothing (AC02, E6)", (_name, type) => {
    const rows = run(`
      ${setup(7)} ${completed(7, 7)}
      ${asUser("operations_manager")}
      ${adjust("first", 7, "'partial_refund'", "330", "'Most of it'")}
      ${adjust("over", 7, type, "120.01", "'A cent too much'")}
      ${state("after", 7)}
      ${adjust("exact", 7, type, "120", "'Exactly what is left'")}
      ${state("zero", 7)}`);

    expect(get(rows, "over")).toEqual(["BA003"]);
    expect(get(rows, "after")).toEqual(["120.00", "36.00", "84.00", "-330.00", "0.00", "null", "1"]);
    expect(get(rows, "exact")).toEqual(["ok"]);
    expect(get(rows, "zero").slice(0, 4)).toEqual(["0.00", "0.00", "0.00", "-450.00"]);
  });

  it.each([
    ["a negative amount", "-0.01", "BA002"],
    ["a large negative amount", "-1000", "BA002"],
    ["zero", "0", "BA002"],
    ["an amount with 3 decimals", "10.001", "BA002"],
    ["not a number (NaN)", "'NaN'::numeric", "BA003"],
    ["infinity", "'Infinity'::numeric", "BA003"],
  ])("should refuse %s with an error that names the amount, and change nothing (AC03, E7)", (_name, amount, code) => {
    const rows = run(`
      ${setup(8)} ${completed(8, 8)}
      ${asUser("operations_manager")}
      ${adjust("one", 8, "'partial_refund'", amount, "'A reason'")}
      ${state("after", 8)}`);

    expect(get(rows, "one")).toEqual([code]);
    expect(get(rows, "after")).toEqual(["450.00", "135.00", "315.00", "0.00", "0.00", "null", "0"]);
  });

  it("should refuse an amount that is text and not a number before the function runs, and record nothing (AC03, E7)", () => {
    const rows = run(`
      ${setup(9)} ${completed(9, 9)}
      ${asUser("operations_manager")}
      do $$ begin
        execute format('select public.add_booking_adjustment(%L, %L, %L, %L)', '${bookingId(9)}', 'partial_refund', 'abc', 'A reason');
        raise notice 'R|text|ok';
      exception when others then
        raise notice 'R|text|%', sqlstate;
      end $$;
      ${state("after", 9)}`);

    expect(get(rows, "text")).toEqual(["22P02"]);
    expect(get(rows, "after")[6]).toBe("0");
  });

  it("should keep the shares adding up after a period change that follows several adjustments", () => {
    const rows = run(`
      ${setup(10)} ${completed(10, 10)}
      ${asUser("operations_manager")}
      ${adjust("a", 10, "'partial_refund'", "80.55", "'First'")}
      ${adjust("b", 10, "'chargeback'", "19.45", "'Second'")}
      ${FLAG_ON}
      update public.bookings set return_at = '2030-01-05 10:00:00+00' where id = '${bookingId(10)}';
      ${state("after", 10)}`);

    // Four days at 75 is 300.00, less 100.00 of adjustments.
    expect(get(rows, "after").slice(0, 4)).toEqual(["200.00", "60.00", "140.00", "-100.00"]);
  });
});
