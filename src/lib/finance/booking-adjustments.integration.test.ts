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
  USER,
} from "@/lib/finance/finance-test-support";

/**
 * VI-F04-S10 (spec R5, R15, R16, R17, V7 to V9, E6, E7): add_booking_adjustment() records a refund,
 * an adjustment or a chargeback and calculates the booking again. A rental of six days at 75 is
 * 450.00 gross; with the terms of 30 percent the partner gets 135.00. Every scenario runs in a
 * transaction that is rolled back and makes its own partner. Needs an operations manager, an admin,
 * a technician and a partner user in the database (present after `npm run demo:reset`). Skipped when
 * the local stack is not running, like the RLS suite.
 */
const START = "2030-01-01 10:00:00+00";
const SIX_DAYS = "2030-01-07 10:00:00+00";

const get = (rows: string[][], name: string) => {
  const row = rows.find((r) => r[0] === name);
  expect(row, name).toBeDefined();
  return row!.slice(1);
};

describe.skipIf(!available)("recording an adjustment (VI-F04-S10, spec R5, R15, R16, R17)", () => {
  it("should take a partial refund off the gross revenue and share what is left, adding up (AC06)", () => {
    const rows = run(`
      ${setup(1)} ${completed(1, 1)}
      ${state("before", 1)}
      ${asUser("operations_manager")}
      ${adjust("refund", 1, "'partial_refund'", "50", "'The customer returned the seat late'")}
      ${state("after", 1)}`);

    expect(get(rows, "before")).toEqual(["450.00", "135.00", "315.00", "0.00", "0.00", "null", "0"]);
    expect(get(rows, "refund")).toEqual(["ok"]);
    expect(get(rows, "after")).toEqual(["400.00", "120.00", "280.00", "-50.00", "0.00", "null", "1"]);
  });

  it("should add adjustments up, one after the other, to the cent", () => {
    const rows = run(`
      ${setup(2)} ${completed(2, 2)}
      ${asUser("operations_manager")}
      ${adjust("a", 2, "'partial_refund'", "50.25", "'First'")}
      ${adjust("b", 2, "'chargeback'", "100.10", "'Second'")}
      ${state("after", 2)}`);

    expect(get(rows, "after")).toEqual(["299.65", "89.90", "209.75", "-150.35", "0.00", "null", "2"]);
  });

  it.each([
    ["a partial refund", "'partial_refund'"],
    ["a full refund", "'full_refund'"],
    ["a manual adjustment", "'manual_adjustment'"],
    ["a chargeback", "'chargeback'"],
  ])("should record %s the same way: the amount is taken off", (_name, type) => {
    const rows = run(`
      ${setup(3)} ${completed(3, 3)}
      ${asUser("admin")}
      ${adjust("one", 3, type, "10", "'A reason'")}
      ${state("after", 3)}`);

    expect(get(rows, "one")).toEqual(["ok"]);
    expect(get(rows, "after").slice(0, 4)).toEqual(["440.00", "132.00", "308.00", "-10.00"]);
  });

  it("should keep who recorded it, when, the type and the reason without the spaces around it (R16)", () => {
    const rows = run(`
      ${setup(4)} ${completed(4, 4)}
      ${asUser("operations_manager")}
      ${adjust("one", 4, "'chargeback'", "20", "'   The bank took it back   '")}
      do $$ declare a record; ok boolean; begin
        select * into a from public.booking_adjustments where booking_id = '${bookingId(4)}';
        ok := a.created_by = ${USER("operations_manager")}::uuid;
        raise notice 'R|row|%|%|%|%|%', a.type, a.amount, a.reason, ok, a.created_at is not null;
      end $$;`);

    expect(get(rows, "row")).toEqual(["chargeback", "20.00", "The bank took it back", "t", "t"]);
  });

  it("should take the whole gross revenue off and leave nothing to share, and then refuse another (E6)", () => {
    const rows = run(`
      ${setup(5)} ${completed(5, 5)}
      ${asUser("operations_manager")}
      ${adjust("all", 5, "'full_refund'", "450", "'Everything back'")}
      ${state("zero", 5)}
      ${adjust("more", 5, "'partial_refund'", "1", "'Nothing left'")}`);

    expect(get(rows, "zero")).toEqual(["0.00", "0.00", "0.00", "-450.00", "0.00", "null", "1"]);
    expect(get(rows, "more")).toEqual(["BA004"]);
  });

  it("should refuse an amount above the gross revenue, even by a cent, and change nothing (AC04, E6)", () => {
    const rows = run(`
      ${setup(6)} ${completed(6, 6)}
      ${asUser("operations_manager")}
      ${adjust("over", 6, "'partial_refund'", "450.01", "'Too much'")}
      ${state("after", 6)}`);

    expect(get(rows, "over")).toEqual(["BA003"]);
    expect(get(rows, "after")).toEqual(["450.00", "135.00", "315.00", "0.00", "0.00", "null", "0"]);
  });

  it("should count what is left, not what the rental earned, after an earlier adjustment (AC04)", () => {
    const rows = run(`
      ${setup(7)} ${completed(7, 7)}
      ${asUser("operations_manager")}
      ${adjust("first", 7, "'partial_refund'", "400", "'Most of it'")}
      ${adjust("second", 7, "'partial_refund'", "51", "'More than is left'")}
      ${adjust("third", 7, "'partial_refund'", "50", "'Exactly what is left'")}`);

    expect([get(rows, "first"), get(rows, "second"), get(rows, "third")]).toEqual([["ok"], ["BA003"], ["ok"]]);
  });

  it.each([
    ["zero", "0"],
    ["negative", "-5"],
    ["with 3 decimals", "10.005"],
  ])("should refuse an amount that is %s (AC04, E7)", (_name, amount) => {
    const rows = run(`
      ${setup(8)} ${completed(8, 8)}
      ${asUser("operations_manager")}
      ${adjust("one", 8, "'partial_refund'", amount, "'A reason'")}
      ${state("after", 8)}`);

    expect(get(rows, "one")).toEqual(["BA002"]);
    expect(get(rows, "after")[3]).toBe("0.00");
  });

  it.each([
    ["empty", "''"],
    ["only spaces", "'    '"],
    ["null", "null"],
    ["longer than 1000 characters", "repeat('x', 1001)"],
  ])("should refuse a reason that is %s (AC05)", (_name, reason) => {
    const rows = run(`
      ${setup(9)} ${completed(9, 9)}
      ${asUser("operations_manager")}
      ${adjust("one", 9, "'partial_refund'", "10", reason)}
      ${state("after", 9)}`);

    expect(get(rows, "one")).toEqual(["BA005"]);
    expect(get(rows, "after")[6]).toBe("0");
  });

  it("should accept a reason of exactly 1000 characters", () => {
    const rows = run(`
      ${setup(10)} ${completed(10, 10)}
      ${asUser("operations_manager")}
      ${adjust("one", 10, "'partial_refund'", "10", "repeat('x', 1000)")}`);

    expect(get(rows, "one")).toEqual(["ok"]);
  });

  it("should refuse a type that is missing or not in the list (AC03)", () => {
    const rows = run(`
      ${setup(11)} ${completed(11, 11)}
      ${asUser("operations_manager")}
      ${adjust("missing", 11, "null::public.booking_adjustment_type", "10", "'A reason'")}
      do $$ begin
        perform public.add_booking_adjustment('${bookingId(11)}', 'bonus'::public.booking_adjustment_type, 10, 'A reason');
        raise notice 'R|unknown|ok';
      exception when others then
        raise notice 'R|unknown|%', sqlstate;
      end $$;`);

    expect(get(rows, "missing")).toEqual(["22023"]);
    expect(get(rows, "unknown")).toEqual(["22P02"]);
  });

  it("should refuse a booking that has no revenue to adjust: pending, cancelled, no-show, no duration (BA004)", () => {
    const rows = run(`
      ${setup(12)}
      ${newBooking(121, 12, SIX_DAYS, "75")}
      ${newBooking(122, 12, SIX_DAYS, "75")}
      ${newBooking(123, 12, SIX_DAYS, "75")}
      ${newBooking(124, 12, START, "75")}
      ${asUser("operations_manager")}
      select public.change_booking_status('${bookingId(122)}', 'cancelled', 'Cancelled');
      select public.change_booking_status('${bookingId(123)}', 'confirmed');
      select public.change_booking_status('${bookingId(123)}', 'no_show', 'Did not come');
      ${completeBooking(124)}
      ${adjust("pending", 121, "'partial_refund'", "1", "'A reason'")}
      ${adjust("cancelled", 122, "'partial_refund'", "1", "'A reason'")}
      ${adjust("noshow", 123, "'partial_refund'", "1", "'A reason'")}
      ${adjust("noduration", 124, "'partial_refund'", "1", "'A reason'")}`);

    expect(["pending", "cancelled", "noshow", "noduration"].map((name) => get(rows, name)[0])).toEqual([
      "BA004",
      "BA004",
      "BA004",
      "BA004",
    ]);
  });

  it("should refuse a booking that has revenue figures but no revenue case, such as one completed long ago (BA004)", () => {
    const rows = run(`
      ${setup(19)} ${completed(19, 19)}
      ${FLAG_ON}
      update public.bookings set revenue_case = null where id = '${bookingId(19)}';
      ${asUser("operations_manager")}
      ${adjust("one", 19, "'partial_refund'", "1", "'A reason'")}`);

    expect(get(rows, "one")).toEqual(["BA004"]);
  });

  it("should refuse a booking that does not exist (P0002)", () => {
    const rows = run(`
      ${asUser("operations_manager")}
      do $$ begin
        perform public.add_booking_adjustment('00000000-0000-4000-8000-00000000dead', 'partial_refund', 1, 'A reason');
        raise notice 'R|one|ok';
      exception when others then
        raise notice 'R|one|%', sqlstate;
      end $$;`);

    expect(get(rows, "one")).toEqual(["P0002"]);
  });

  it.each([
    ["a technician", "technician"],
    ["a partner user", "partner_user"],
    ["nobody signed in", null],
  ])("should refuse %s and record nothing (AC02, 42501)", (_name, role) => {
    const rows = run(`
      ${setup(13)} ${completed(13, 13)}
      ${asUser(role)}
      ${adjust("one", 13, "'partial_refund'", "10", "'A reason'")}
      ${state("after", 13)}`);

    expect(get(rows, "one")).toEqual(["42501"]);
    expect(get(rows, "after")).toEqual(["450.00", "135.00", "315.00", "0.00", "0.00", "null", "0"]);
  });

  it("should refuse a user who is not active", () => {
    const rows = run(`
      ${setup(14)} ${completed(14, 14)}
      select set_config('request.jwt.claim.sub', coalesce(
        (select id::text from public.users u where not u.is_active order by u.email limit 1), ''), true);
      ${adjust("one", 14, "'partial_refund'", "10", "'A reason'")}`);

    expect(get(rows, "one")).toEqual(["42501"]);
  });

  it("should not change the launch credit, and share what is left at the launch share (Q4 assumption)", () => {
    // Three days at 90: 270.00 gross; standard 81.00, launch 135.00, credit 54.00. A refund of 70.
    const rows = run(`
      ${setup(15, { target: "1000" })}
      ${newBooking(151, 15, "2030-01-04 10:00:00+00", "90")}
      ${completeBooking(151)}
      ${asUser("operations_manager")}
      ${adjust("refund", 151, "'partial_refund'", "70", "'A refund'")}
      ${state("after", 151)}`);

    expect(get(rows, "after")).toEqual(["200.00", "100.00", "100.00", "-70.00", "54.00", "54.00", "1"]);
  });

  it("should keep the adjustments when the period of the rental changes afterwards (R15)", () => {
    const rows = run(`
      ${setup(16)} ${completed(16, 16)}
      ${asUser("operations_manager")}
      ${adjust("refund", 16, "'partial_refund'", "50", "'A refund'")}
      ${FLAG_ON}
      update public.bookings set return_at = '2030-01-09 10:00:00+00' where id = '${bookingId(16)}';
      ${state("longer", 16)}`);

    // Capped at six paid days, so the same 450.00 less the 50.00 that was refunded.
    expect(get(rows, "longer").slice(0, 4)).toEqual(["400.00", "120.00", "280.00", "-50.00"]);
  });

  it("should never let the gross revenue go below zero when the period gets shorter than the refunds", () => {
    const rows = run(`
      ${setup(17)} ${completed(17, 17)}
      ${asUser("operations_manager")}
      ${adjust("refund", 17, "'partial_refund'", "400", "'A big refund'")}
      ${FLAG_ON}
      update public.bookings set return_at = '2030-01-02 10:00:00+00' where id = '${bookingId(17)}';
      ${state("shorter", 17)}`);

    expect(get(rows, "shorter").slice(0, 4)).toEqual(["0.00", "0.00", "0.00", "-400.00"]);
  });

  it("should not let anyone change the adjustments total of a booking outside the booking functions (55000)", () => {
    const rows = run(`
      ${setup(18)} ${completed(18, 18)}
      select set_config('app.booking_change', '', true);
      do $$ begin
        update public.bookings set adjustments_total = -10 where id = '${bookingId(18)}';
        raise notice 'R|one|allowed';
      exception when others then
        raise notice 'R|one|%', sqlstate;
      end $$;`);

    expect(get(rows, "one")).toEqual(["55000"]);
  });
});
