import { spawn } from "node:child_process";

import { describe, expect, it } from "vitest";

import { dbContainer, runSql } from "@/lib/db-test-support";
import {
  FLAG_ON,
  PARTNER,
  available,
  bookingId,
  completeBooking,
  newBooking,
  newPartner,
  newTerms,
  run,
  termsId,
} from "@/lib/finance/finance-test-support";

/**
 * VI-F04-S06 (spec R12, R13, E3, E4): while launch terms are active, the extra share the partner
 * gets above the standard share builds up toward the launch credit target; once it is reached the
 * standard share applies; completions of one partner are calculated one after the other.
 *
 * A rental of three days at 90 is 270 gross: the standard 30 percent is 81.00, the launch 50
 * percent is 135.00, so each rental adds 54.00 of launch credit. Every scenario runs in a
 * transaction that is rolled back and makes its own partner. Skipped when the local stack is not
 * running, like the RLS suite.
 */
const START = "2030-01-01 10:00:00+00";
const THREE_DAYS = "2030-01-04 10:00:00+00";
const SIX_DAYS = "2030-01-07 10:00:00+00";

const STANDARD = 30;
const LAUNCH = 50;

/** One partner with one version of the terms (30 / 50), and a target. */
const setup = (partner: number, target: string, launch = LAUNCH) => `
  ${newPartner(partner)}
  ${newTerms(partner, partner, STANDARD, "date '2020-01-01'", "null", launch, target)}`;

/** Completes the next rental of a partner and reports what was written. */
const rental = (
  n: number,
  partner: number,
  options: { ret?: string; rate?: string; pickup?: string } = {},
) => `
  ${newBooking(n, partner, options.ret ?? THREE_DAYS, options.rate ?? "90", options.pickup ?? START)}
  ${completeBooking(n)}
  do $$ declare b record; begin
    select * into b from public.bookings where id = '${bookingId(n)}';
    raise notice 'R|r${n}|%|%|%|%|%', b.partner_share, b.platform_share, b.launch_credit,
      coalesce(b.launch_credit_balance::text, 'null'), coalesce(b.revenue_flag, 'null');
  end $$;`;

/** Reports the copy for display on a version of the terms (launch_mode shows as t or f). */
const cache = (name: string, terms: number) => `
  do $$ declare t record; begin
    select * into t from public.partner_commercial_terms where id = '${termsId(terms)}';
    raise notice 'R|${name}|%|%', t.launch_credit_accumulated, t.launch_mode;
  end $$;`;

const get = (rows: string[][], name: string) => {
  const row = rows.find((r) => r[0] === name);
  expect(row, name).toBeDefined();
  return row!.slice(1);
};

describe.skipIf(!available)("launch credit (VI-F04-S06, spec R12, R13, E3, E4)", () => {
  it("should give the launch share, and keep the extra as launch credit, while launch is active (AC01)", () => {
    const rows = run(`${setup(1, "1000")} ${rental(1, 1)} ${cache("cache", 1)}`);

    // 135.00 + 135.00 = 270.00; the standard share would have been 81.00, so 54.00 is credit.
    expect(get(rows, "r1")).toEqual(["135.00", "135.00", "54.00", "54.00", "null"]);
    expect(get(rows, "cache")).toEqual(["54.00", "t"]);
  });

  it("should add the credit up, rental after rental, in the order they are completed (AC01)", () => {
    const rows = run(`${setup(2, "1000")} ${[1, 2, 3, 4, 5].map((i) => rental(10 + i, 2)).join("\n")}`);

    expect([11, 12, 13, 14, 15].map((n) => get(rows, `r${n}`)[3])).toEqual(["54.00", "108.00", "162.00", "216.00", "270.00"]);
  });

  it("should use the standard share for every rental after the target is reached (AC02, R13)", () => {
    // Target 108: the second rental brings the balance to exactly 108, so the third is standard.
    const rows = run(`${setup(3, "108")} ${rental(21, 3)} ${rental(22, 3)} ${rental(23, 3)} ${rental(24, 3)} ${cache("cache", 3)}`);

    expect(get(rows, "r21")).toEqual(["135.00", "135.00", "54.00", "54.00", "null"]);
    expect(get(rows, "r22")).toEqual(["135.00", "135.00", "54.00", "108.00", "null"]);
    expect(get(rows, "r23")).toEqual(["81.00", "189.00", "0.00", "null", "null"]);
    expect(get(rows, "r24")).toEqual(["81.00", "189.00", "0.00", "null", "null"]);
    expect(get(rows, "cache")).toEqual(["108.00", "f"]);
  });

  it("should give the whole rental that crosses the target the launch share, and record the balance above it (AC03, E3)", () => {
    // Target 100: after the first rental the balance is 54; the second takes it to 108, above 100.
    const rows = run(`${setup(4, "100")} ${rental(31, 4)} ${rental(32, 4)} ${rental(33, 4)}`);

    expect(get(rows, "r32")).toEqual(["135.00", "135.00", "54.00", "108.00", "null"]);
    expect(Number(get(rows, "r32")[3])).toBeGreaterThan(100);
    expect(get(rows, "r33")).toEqual(["81.00", "189.00", "0.00", "null", "null"]);
  });

  it("should give the same answer for the same rentals in the same order (AC03: deterministic)", () => {
    const script = (partner: number, base: number) =>
      `${setup(partner, "100")} ${rental(base + 1, partner)} ${rental(base + 2, partner)} ${rental(base + 3, partner)}`;

    const first = run(script(5, 40));
    const second = run(script(6, 50));

    expect([41, 42, 43].map((n) => get(first, `r${n}`))).toEqual([51, 52, 53].map((n) => get(second, `r${n}`)));
  });

  it.each([
    ["no target at all", "null"],
    ["a target of zero", "0"],
  ])("should use the standard share from the first rental with %s", (_name, target) => {
    const rows = run(`${setup(7, target)} ${rental(61, 7)} ${cache("cache", 7)}`);

    expect(get(rows, "r61")).toEqual(["81.00", "189.00", "0.00", "null", "null"]);
    expect(get(rows, "cache")[1]).toBe("f");
  });

  it("should not add credit when the launch share equals the standard share: launch stays active at zero", () => {
    const rows = run(`${setup(8, "1000", STANDARD)} ${rental(71, 8)} ${rental(72, 8)}`);

    expect(get(rows, "r71")).toEqual(["81.00", "189.00", "0.00", "0.00", "null"]);
    expect(get(rows, "r72")).toEqual(["81.00", "189.00", "0.00", "0.00", "null"]);
  });

  it("should keep the balances of two partners apart", () => {
    const rows = run(`${setup(9, "1000")} ${setup(10, "1000")} ${rental(81, 9)} ${rental(82, 9)} ${rental(83, 10)}`);

    expect(get(rows, "r82")[3]).toBe("108.00");
    expect(get(rows, "r83")[3]).toBe("54.00");
  });

  it("should round the credit to the cent, and keep the shares adding up to the gross (R17)", () => {
    // Gross 199.98 (six paid days at 33.33): standard 59.99, launch 99.99, credit 40.00.
    const rows = run(`${setup(11, "1000")} ${rental(91, 11, { ret: "2030-01-08 10:00:00+00", rate: "33.33" })}`);

    const [partner, platform, credit, balance] = get(rows, "r91");
    expect([partner, platform, credit, balance]).toEqual(["99.99", "99.99", "40.00", "40.00"]);
    expect(Number(partner) + Number(platform)).toBeCloseTo(199.98, 2);
  });

  it("should count only completed rentals toward the balance", () => {
    const rows = run(`
      ${setup(12, "1000")}
      ${newBooking(100, 12, THREE_DAYS, "90")}
      ${FLAG_ON}
      update public.bookings set status = 'confirmed' where id = '${bookingId(100)}';
      ${rental(101, 12)}`);

    expect(get(rows, "r101")[3]).toBe("54.00");
  });

  it("should replay a rental at its own place when its period changes, and leave the others alone", () => {
    const rows = run(`
      ${setup(13, "1000")}
      ${rental(111, 13)}
      ${rental(112, 13)}
      update public.bookings set return_at = '${SIX_DAYS}' where id = '${bookingId(111)}';
      do $$ declare a record; b record; begin
        select * into a from public.bookings where id = '${bookingId(111)}';
        select * into b from public.bookings where id = '${bookingId(112)}';
        raise notice 'R|again|%|%|%|%', a.gross_revenue, a.launch_credit, a.launch_credit_balance, b.launch_credit_balance;
      end $$;
      ${cache("cache", 13)}`);

    // Six days at 90: gross 540; standard 162.00, launch 270.00, so 108.00 of credit, from a balance of 0.
    expect(get(rows, "again")).toEqual(["540.00", "108.00", "108.00", "108.00"]);
    // The copy for display is the sum of the credit of the partner: 108.00 + 54.00.
    expect(get(rows, "cache")).toEqual(["162.00", "t"]);
  });

  it("should keep a rental calculated at the standard share standard when it is calculated again", () => {
    const rows = run(`
      ${setup(14, "54")}
      ${rental(121, 14)}
      ${rental(122, 14)}
      update public.bookings set return_at = '${SIX_DAYS}' where id = '${bookingId(122)}';
      do $$ declare b record; begin
        select * into b from public.bookings where id = '${bookingId(122)}';
        raise notice 'R|again|%|%|%', b.partner_share, b.launch_credit, coalesce(b.launch_credit_balance::text, 'null');
      end $$;`);

    expect(get(rows, "r122")[3]).toBe("null");
    expect(get(rows, "again")).toEqual(["162.00", "0.00", "null"]);
  });

  it("should end launch for a later rental when the target is lowered below the balance", () => {
    const rows = run(`
      ${setup(15, "1000")}
      ${rental(131, 15)}
      update public.partner_commercial_terms set effective_to = current_date - 1 where id = '${termsId(15)}';
      ${newTerms(150, 15, STANDARD, "current_date", "null", LAUNCH, "50")}
      ${rental(132, 15)}`);

    expect(get(rows, "r131")[3]).toBe("54.00");
    expect(get(rows, "r132")).toEqual(["81.00", "189.00", "0.00", "null", "null"]);
  });

  it("should not let anyone change the launch credit of a booking outside the booking functions (55000)", () => {
    const rows = run(`
      ${setup(16, "1000")}
      ${rental(141, 16)}
      select set_config('app.booking_change', '', true);
      do $$ declare c text; begin
        foreach c in array array['launch_credit = 0', 'launch_credit_balance = 1'] loop
          begin
            execute format('update public.bookings set %s where id = %L', c, '${bookingId(141)}');
            raise notice 'R|%|allowed', c;
          exception when others then
            raise notice 'R|%|%', c, sqlstate;
          end;
        end loop;
      end $$;`);

    expect(rows.filter((r) => r[0].startsWith("launch")).map((r) => r[1])).toEqual(["55000", "55000"]);
  });

  // AC04 (E4): two rentals of one partner completed at the same time are calculated one after the
  // other. The completion takes the lock of the partner row before it reads the balance, so the
  // next one waits and then reads the balance with the first one in it. Here one session completes
  // a rental and holds its transaction open; a second session must not get the lock of the partner
  // until the first one ends. The first session rolls back, so nothing is left behind.
  it("should hold the lock of the partner from the completion to the end of the transaction (AC04)", async () => {
    const container = dbContainer()!;
    const first = spawn(
      "docker",
      ["exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"],
      { stdio: ["pipe", "ignore", "pipe"] },
    );
    let output = "";
    first.stderr.on("data", (chunk) => (output += String(chunk)));
    const ended = new Promise<number | null>((resolve) => first.on("close", resolve));

    first.stdin.write(`
      begin;
      insert into public.partner_commercial_terms
        (partner_id, partner_share_percent, platform_share_percent, launch_partner_share_percent, launch_credit_target, effective_from)
      values ('${PARTNER}', 30, 70, 50, 5000, current_date);
      insert into public.bookings (id, booking_number, partner_id, airport_id, pickup_at, return_at, seat_category_id, daily_rate)
      values ('d6000000-0000-0000-0000-000000000001', 'LC-1', '${PARTNER}', 'a0000000-0000-0000-0000-000000000001',
              '${START}', '${THREE_DAYS}', 'c0000000-0000-0000-0000-000000000001', 90);
      ${FLAG_ON}
      update public.bookings set status = 'completed' where id = 'd6000000-0000-0000-0000-000000000001';
      do $$ begin raise notice 'COMPLETED'; end $$;
      select pg_sleep(8);
      rollback;
    `);
    first.stdin.end();

    // Wait until the first session has completed its rental and holds the lock.
    for (let waited = 0; !output.includes("COMPLETED") && waited < 10_000; waited += 100) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    expect(output).toContain("COMPLETED");

    const whileOpen = runSql(`set lock_timeout = '700ms'; begin; select 1 from public.partners where id = '${PARTNER}' for update; rollback;`);

    expect(whileOpen?.ok).toBe(false);
    expect(whileOpen?.output).toMatch(/lock timeout/);

    expect(await ended).toBe(0);

    const afterwards = runSql(`set lock_timeout = '700ms'; begin; select 1 from public.partners where id = '${PARTNER}' for update; rollback;`);

    expect(afterwards?.ok).toBe(true);
  }, 30_000);
});
