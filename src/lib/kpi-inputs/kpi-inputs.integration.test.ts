import { describe, expect, it } from "vitest";

import {
  AIRPORT,
  CATEGORY,
  PARTNER,
  USER,
  asUser,
  available,
  bookingId,
  newPartner,
  partnerId,
  run,
} from "@/lib/finance/finance-test-support";

/**
 * VI-F05-T01: the inputs of the KPI formulas are stored: the deadline of an installation job, the
 * moment and the actor of Family Ready, and the result of a seat scan. Every scenario runs in a
 * transaction that is rolled back and makes its own partners, bookings, seats and jobs. The calls
 * that need a signed-in user set `request.jwt.claim.sub`, as the other database suites do. Skipped
 * when the local stack is not running.
 */
const PICKUP = "2030-01-10 12:00:00+00";
const OTHER_PARTNER = "b0000000-0000-0000-0000-000000000002";

const TECH = USER("technician");
const OTHER_TECHNICIAN = `(select id::text from public.users u where u.role = 'technician' and u.is_active order by u.email limit 1 offset 1)`;

const pad = (n: number) => String(n).padStart(12, "0");
const jobId = (n: number) => `d9100000-0000-0000-0000-${pad(n)}`;
const flightId = (n: number) => `d9200000-0000-0000-0000-${pad(n)}`;
const seatId = (n: number) => `d9300000-0000-0000-0000-${pad(n)}`;

const signedInAs = (user: string) => `select set_config('request.jwt.claim.sub', coalesce(${user}, ''), true);`;
const signedOut = asUser(null);

/** Three seats of this test, available, so no result depends on the demo data. */
const SEATS = [1, 2, 3]
  .map(
    (n) => `insert into public.seats (id, serial_number, manufacturer, model, category_id, airport_id, manufacture_date, purchase_date, max_rental_cycles)
            values ('${seatId(n)}', 'KP-SEAT-${n}', 'Test', 'Test', '${CATEGORY}', '${AIRPORT}', date '2029-01-01', date '2029-01-01', 100);`,
  )
  .join("\n");

interface BookingOptions {
  pickup?: string;
  seat?: number | null;
  partner?: string;
}

/** A booking of its own partner (or of the partner given), with the technician and, if asked, a seat. */
const booking = (n: number, options: BookingOptions = {}) => `
  ${options.partner ? "" : newPartner(n)}
  insert into public.bookings (id, booking_number, partner_id, airport_id, pickup_at, return_at, seat_category_id, daily_rate, assigned_seat_id, assigned_technician_id)
  values ('${bookingId(n)}', 'KP-${n}', '${options.partner ?? partnerId(n)}', '${AIRPORT}', '${options.pickup ?? PICKUP}', timestamptz '${options.pickup ?? PICKUP}' + interval '3 days', '${CATEGORY}', 90,
          ${options.seat ? `'${seatId(options.seat)}'` : "null"}, ${TECH}::uuid);`;

const job = (n: number, bookingN: number, type = "installation") => `
  insert into public.technician_jobs (id, booking_id, technician_id, job_type)
  values ('${jobId(n)}', '${bookingId(bookingN)}', ${TECH}::uuid, '${type}');`;

const flight = (n: number, estimated: string) => `
  insert into public.flights (id, flight_number, airport_id, scheduled_arrival_at, estimated_arrival_at)
  values ('${flightId(n)}', 'KP ${n}', '${AIRPORT}', '2030-01-10 11:00:00+00', '${estimated}');`;

const link = (bookingN: number, flightN: number | null) =>
  `update public.bookings set flight_id = ${flightN ? `'${flightId(flightN)}'` : "null"} where id = '${bookingId(bookingN)}';`;

const estimate = (flightN: number, value: string) =>
  `update public.flights set estimated_arrival_at = '${value}' where id = '${flightId(flightN)}';`;

/** The booking schedule and the job status are protected columns; the owner changes them with the signals the RPCs set. */
const asRpc = (signal: string, statement: string) => `
  select set_config('${signal}', 'on', true);
  ${statement}
  select set_config('${signal}', '', true);`;

const deadline = (name: string, n: number) => `
  do $$ begin
    raise notice 'R|${name}|%', coalesce((select to_char(deadline_at at time zone 'UTC', 'MM-DD HH24:MI')
                                             from public.technician_jobs where id = '${jobId(n)}'), 'null');
  end $$;`;

const result = (rows: string[][], name: string) => rows.find((row) => row[0] === name)?.slice(1).join("|");

describe.skipIf(!available)("job deadline (VI-F05-T01, AC01, AC02, AC06)", () => {
  it("should set an installation job to 60 minutes before pickup, and no other job type", () => {
    const rows = run(`
      ${booking(1)}
      ${job(1, 1)}
      ${job(2, 1, "cleaning")}
      ${deadline("installation", 1)}
      ${deadline("cleaning", 2)}`);

    expect(result(rows, "installation")).toBe("01-10 11:00");
    expect(result(rows, "cleaning")).toBe("null");
  });

  it("should drop a deadline sent by the client when the job is created, and keep the stored one on a direct update", () => {
    const rows = run(`
      ${booking(1)}
      insert into public.technician_jobs (id, booking_id, technician_id, job_type, deadline_at)
      values ('${jobId(1)}', '${bookingId(1)}', ${TECH}::uuid, 'installation', '2000-01-01 00:00:00+00');
      ${deadline("created", 1)}
      update public.technician_jobs set deadline_at = '2000-01-01 00:00:00+00' where id = '${jobId(1)}';
      ${deadline("updated", 1)}`);

    expect(result(rows, "created")).toBe("01-10 11:00");
    expect(result(rows, "updated")).toBe("01-10 11:00");
  });

  it("should move the deadline by the delay of the flight and count it from the pickup time each time", () => {
    const rows = run(`
      ${booking(2)}
      ${flight(2, "2030-01-10 11:45:00+00")}
      ${link(2, 2)}
      ${job(3, 2)}
      ${deadline("late-45", 3)}
      ${estimate(2, "2030-01-10 12:15:00+00")}
      ${deadline("late-75", 3)}
      ${estimate(2, "2030-01-10 11:00:00+00")}
      ${deadline("on-time", 3)}`);

    expect(result(rows, "late-45")).toBe("01-10 11:45");
    expect(result(rows, "late-75")).toBe("01-10 12:15");
    expect(result(rows, "on-time")).toBe("01-10 11:00");
  });

  it("should move the deadline by the delay only when the flight is 15 minutes or more late, and back to the base when the estimate returns under 15 (VI-F02-S05 AC01)", () => {
    const rows = run(`
      ${booking(2)}
      ${flight(2, "2030-01-10 11:14:00+00")}
      ${link(2, 2)}
      ${job(3, 2)}
      ${deadline("late-14", 3)}
      ${estimate(2, "2030-01-10 11:15:00+00")}
      ${deadline("late-15", 3)}
      ${estimate(2, "2030-01-10 11:16:00+00")}
      ${deadline("late-16", 3)}
      ${estimate(2, "2030-01-10 11:14:30+00")}
      ${deadline("late-14-30", 3)}
      ${estimate(2, "2030-01-10 11:14:29+00")}
      ${deadline("late-14-29", 3)}
      ${estimate(2, "2030-01-10 11:45:00+00")}
      ${deadline("late-45", 3)}
      ${estimate(2, "2030-01-10 11:05:00+00")}
      ${deadline("late-5-again", 3)}`);

    expect(result(rows, "late-14")).toBe("01-10 11:00");
    expect(result(rows, "late-15")).toBe("01-10 11:15");
    expect(result(rows, "late-16")).toBe("01-10 11:16");
    expect(result(rows, "late-14-30")).toBe("01-10 11:15");
    expect(result(rows, "late-14-29")).toBe("01-10 11:00");
    expect(result(rows, "late-45")).toBe("01-10 11:45");
    expect(result(rows, "late-5-again")).toBe("01-10 11:00");
  });

  it("should apply the 15 minute rule to the actual arrival and to delay_minutes alone, not only to the estimate (VI-F02-S05 AC01)", () => {
    const rows = run(`
      ${booking(15)}
      ${flight(15, "2030-01-10 11:00:00+00")}
      ${link(15, 15)}
      ${job(15, 15)}
      update public.flights set actual_arrival_at = '2030-01-10 11:10:00+00' where id = '${flightId(15)}';
      ${deadline("actual-10", 15)}
      update public.flights set actual_arrival_at = null, estimated_arrival_at = null, delay_minutes = 10 where id = '${flightId(15)}';
      ${deadline("minutes-10", 15)}
      update public.flights set delay_minutes = 15 where id = '${flightId(15)}';
      ${deadline("minutes-15", 15)}`);

    expect(result(rows, "actual-10")).toBe("01-10 11:00");
    expect(result(rows, "minutes-10")).toBe("01-10 11:00");
    expect(result(rows, "minutes-15")).toBe("01-10 11:15");
  });

  it("should move the deadline earlier by the same minutes when the flight is 15 minutes or more early, and back to the base when the estimate returns to the schedule (VI-F02-S04 AC01, AC04)", () => {
    const rows = run(`
      ${booking(2)}
      ${flight(2, "2030-01-10 10:15:00+00")}
      ${link(2, 2)}
      ${job(3, 2)}
      ${deadline("early-45", 3)}
      ${estimate(2, "2030-01-10 10:45:00+00")}
      ${deadline("early-15", 3)}
      ${estimate(2, "2030-01-10 10:46:00+00")}
      ${deadline("early-14", 3)}
      ${estimate(2, "2030-01-10 10:15:00+00")}
      ${deadline("early-again", 3)}
      ${estimate(2, "2030-01-10 11:00:00+00")}
      ${deadline("on-time", 3)}`);

    expect(result(rows, "early-45")).toBe("01-10 10:15");
    expect(result(rows, "early-15")).toBe("01-10 10:45");
    expect(result(rows, "early-14")).toBe("01-10 11:00");
    expect(result(rows, "early-again")).toBe("01-10 10:15");
    expect(result(rows, "on-time")).toBe("01-10 11:00");
  });

  it("should move the deadline earlier from delay_minutes alone when it is negative and the flight has no estimate (VI-F02-S04 AC01)", () => {
    const rows = run(`
      ${booking(2)}
      ${flight(2, "2030-01-10 11:00:00+00")}
      update public.flights set estimated_arrival_at = null, delay_minutes = -30 where id = '${flightId(2)}';
      ${link(2, 2)}
      ${job(3, 2)}
      ${deadline("early-minutes", 3)}`);

    expect(result(rows, "early-minutes")).toBe("01-10 10:30");
  });

  it("should read the delay as the screens do: the actual arrival first, then the estimate, then delay_minutes alone", () => {
    const rows = run(`
      ${booking(15)}
      ${flight(15, "2030-01-10 11:20:00+00")}
      ${link(15, 15)}
      ${job(15, 15)}
      ${deadline("estimate", 15)}
      update public.flights set actual_arrival_at = '2030-01-10 11:50:00+00' where id = '${flightId(15)}';
      ${deadline("actual", 15)}
      update public.flights set actual_arrival_at = null, estimated_arrival_at = null, delay_minutes = 40 where id = '${flightId(15)}';
      ${deadline("delay-minutes", 15)}`);

    expect(result(rows, "estimate")).toBe("01-10 11:20");
    expect(result(rows, "actual")).toBe("01-10 11:50");
    expect(result(rows, "delay-minutes")).toBe("01-10 11:40");
  });

  it("should follow a change of the pickup time and of the flight of the booking", () => {
    const rows = run(`
      ${booking(3)}
      ${flight(3, "2030-01-10 11:30:00+00")}
      ${job(4, 3)}
      ${deadline("start", 4)}
      ${asRpc("app.booking_change", `update public.bookings set pickup_at = '2030-01-10 14:00:00+00' where id = '${bookingId(3)}';`)}
      ${deadline("pickup-moved", 4)}
      ${link(3, 3)}
      ${deadline("flight-linked", 4)}
      ${link(3, null)}
      ${deadline("flight-removed", 4)}`);

    expect(result(rows, "start")).toBe("01-10 11:00");
    expect(result(rows, "pickup-moved")).toBe("01-10 13:00");
    expect(result(rows, "flight-linked")).toBe("01-10 13:30");
    expect(result(rows, "flight-removed")).toBe("01-10 13:00");
  });

  it("should leave a closed job and a job that had no deadline before alone when the flight moves", () => {
    const rows = run(`
      ${booking(4)}
      ${flight(4, "2030-01-10 11:30:00+00")}
      ${link(4, 4)}
      ${job(5, 4)}
      ${booking(5)}
      ${link(5, 4)}
      ${job(6, 5)}
      ${asRpc("app.job_status_change", `update public.technician_jobs set status = 'cancelled' where id = '${jobId(5)}';`)}
      ${asRpc("app.job_deadline_change", `update public.technician_jobs set deadline_at = null where id = '${jobId(6)}';`)}
      ${estimate(4, "2030-01-10 12:30:00+00")}
      ${deadline("closed", 5)}
      ${deadline("legacy", 6)}`);

    expect(result(rows, "closed")).toBe("01-10 11:30");
    expect(result(rows, "legacy")).toBe("null");
  });
});

describe.skipIf(!available)("Family Ready moment and actor (VI-F05-T01, AC03, AC06)", () => {
  const familyReady = (name: string, n: number) => `
    do $$ declare b record; begin
      select family_ready_at, family_ready_by into b from public.bookings where id = '${bookingId(n)}';
      raise notice 'R|${name}|%|%', b.family_ready_at is not null, coalesce(b.family_ready_by = ${TECH}::uuid, false);
    end $$;`;

  it("should store the moment and the user when the booking reaches Family Ready, and keep them after later changes", () => {
    const rows = run(`
      ${booking(6)}
      ${booking(7)}
      ${familyReady("before", 6)}
      ${signedInAs(TECH)}
      ${asRpc("app.booking_change", `update public.bookings set status = 'family_ready' where id = '${bookingId(6)}';`)}
      ${familyReady("reached", 6)}
      select set_config('t.moment', (select family_ready_at::text from public.bookings where id = '${bookingId(6)}'), true);
      update public.bookings set family_ready_at = '2000-01-01 00:00:00+00', family_ready_by = null where id = '${bookingId(6)}';
      ${asRpc("app.booking_change", `update public.bookings set status = 'in_progress' where id = '${bookingId(6)}';`)}
      ${familyReady("later", 6)}
      do $$ begin
        raise notice 'R|same|%', (select family_ready_at::text from public.bookings where id = '${bookingId(6)}') = current_setting('t.moment');
      end $$;
      ${familyReady("never", 7)}`);

    expect(result(rows, "before")).toBe("false|false");
    expect(result(rows, "reached")).toBe("true|true");
    expect(result(rows, "later")).toBe("true|true");
    expect(result(rows, "same")).toBe("true");
    expect(result(rows, "never")).toBe("false|false");
  });
});

describe.skipIf(!available)("seat scans and the match of an installation (VI-F05-T01, AC04, AC06)", () => {
  const scan = (name: string, jobN: number, kind: string, value: string) => `
    do $$ begin
      raise notice 'R|${name}|%', public.record_installation_seat_scan('${jobId(jobN)}', '${kind}', ${value});
    exception when others then
      raise notice 'R|${name}|%', sqlstate;
    end $$;`;

  const serial = (n: number) => `'KP-SEAT-${n}'`;

  /** `seatMatch` is what a client might send; the database must drop it. */
  const install = (jobN: number, seatMatch?: boolean) => `
    insert into public.installations (technician_job_id, completed_at, installation_completed${seatMatch === undefined ? "" : ", seat_match"})
    values ('${jobId(jobN)}', now(), true${seatMatch === undefined ? "" : `, ${seatMatch}`});`;

  const seatMatch = (name: string, jobN: number) => `
    do $$ begin
      raise notice 'R|${name}|%', coalesce((select seat_match::text from public.installations where technician_job_id = '${jobId(jobN)}'), 'none');
    end $$;`;

  const setup = `
    ${SEATS}
    ${booking(8, { seat: 1 })}
    ${booking(9, { seat: 2 })}
    ${booking(10, { seat: 3 })}
    ${booking(11, { seat: 1, pickup: "2030-03-10 12:00:00+00" })}
    ${booking(12)}
    ${job(8, 8)}
    ${job(9, 9)}
    ${job(10, 10)}
    ${job(11, 11)}
    ${job(12, 12)}
    ${job(13, 8, "cleaning")}
    ${signedInAs(TECH)}`;

  it("should store a matching scan and give the installation seat_match true", () => {
    const rows = run(`
      ${setup}
      ${scan("serial", 8, "serial", serial(1))}
      ${scan("token", 8, "token", `(select public_token from public.seats where id = '${seatId(1)}')`)}
      ${install(8)}
      ${seatMatch("installation", 8)}`);

    expect(result(rows, "serial")).toBe("true");
    expect(result(rows, "token")).toBe("true");
    expect(result(rows, "installation")).toBe("true");
  });

  it("should store a mismatch and an unknown code, and not count the installation as a correct seat", () => {
    const rows = run(`
      ${setup}
      ${scan("other-seat", 9, "serial", serial(1))}
      ${scan("unknown", 9, "serial", "'NOPE'")}
      do $$ begin
        raise notice 'R|log|%|%|%',
          (select count(*) from public.installation_seat_scans where technician_job_id = '${jobId(9)}'),
          (select count(*) from public.installation_seat_scans where technician_job_id = '${jobId(9)}' and scanned_seat_id = '${seatId(1)}' and not matched),
          (select count(*) from public.installation_seat_scans where technician_job_id = '${jobId(9)}' and scanned_seat_id is null and not matched);
      end $$;
      ${install(9)}
      ${seatMatch("installation", 9)}`);

    expect(result(rows, "other-seat")).toBe("false");
    expect(result(rows, "unknown")).toBe("false");
    expect(result(rows, "log")).toBe("2|1|1");
    expect(result(rows, "installation")).toBe("false");
  });

  it("should let the latest scan of the job decide, and leave seat_match empty when there was no scan, whatever the client sends", () => {
    const rows = run(`
      ${setup}
      ${scan("first", 10, "serial", serial(1))}
      ${scan("second", 10, "serial", serial(3))}
      ${install(10)}
      ${seatMatch("rescanned", 10)}
      ${install(11, true)}
      ${seatMatch("not-scanned", 11)}`);

    expect(result(rows, "first")).toBe("false");
    expect(result(rows, "second")).toBe("true");
    expect(result(rows, "rescanned")).toBe("true");
    expect(result(rows, "not-scanned")).toBe("null");
  });

  it("should read a typed serial in another case as the scan screen does, and not when it names no single seat", () => {
    const rows = run(`
      ${setup}
      ${scan("other-case", 8, "serial", "'kp-seat-1'")}
      ${scan("padded", 8, "serial", "'  KP-SEAT-1 '")}
      ${scan("partial", 8, "serial", "'KP-SEAT'")}`);

    expect(result(rows, "other-case")).toBe("true");
    expect(result(rows, "padded")).toBe("true");
    expect(result(rows, "partial")).toBe("false");
  });

  it("should refuse a scan from nobody, from another technician, with a bad code, on a job that is not an installation or has no seat", () => {
    const rows = run(`
      ${setup}
      ${signedOut}
      ${scan("nobody", 8, "serial", serial(1))}
      ${signedInAs(OTHER_TECHNICIAN)}
      ${scan("other-technician", 8, "serial", serial(1))}
      ${signedInAs(TECH)}
      ${scan("bad-kind", 8, "qr", serial(1))}
      ${scan("empty", 8, "serial", "'  '")}
      ${scan("cleaning", 13, "serial", serial(1))}
      ${scan("no-seat", 12, "serial", serial(1))}
      do $$ begin
        raise notice 'R|rows|%', (select count(*) from public.installation_seat_scans);
      end $$;`);

    expect(result(rows, "nobody")).toBe("42501");
    expect(result(rows, "other-technician")).toBe("42501");
    expect(result(rows, "bad-kind")).toBe("22023");
    expect(result(rows, "empty")).toBe("22023");
    expect(result(rows, "cleaning")).toBe("JB005");
    expect(result(rows, "no-seat")).toBe("JB007");
    expect(result(rows, "rows")).toBe("0");
  });
});

describe.skipIf(!available)("who can read the new fields (VI-F05-T01, AC05, cross-tenant denial)", () => {
  const USER_OF = (name: string, role: string, partner: string | null) => `
    select set_config('t.${name}', coalesce(
      (select id::text from public.users u where u.role = '${role}' and u.is_active
         ${partner ? `and u.partner_id = '${partner}'` : ""} order by u.email limit 1), ''), true);`;

  const readAs = (name: string, key: string) => `
    select set_config('request.jwt.claim.sub', current_setting('t.${key}'), true);
    do $$ begin
      raise notice 'R|${name}|%|%|%',
        (select count(*) from public.installation_seat_scans where technician_job_id = '${jobId(14)}'),
        (select count(*) from public.technician_jobs where id = '${jobId(14)}' and deadline_at is not null),
        (select count(*) from public.bookings where id = '${bookingId(14)}' and family_ready_at is not null);
    end $$;`;

  const rows = available
    ? run(`
        ${USER_OF("ops", "operations_manager", null)}
        ${USER_OF("owner", "partner_user", PARTNER)}
        ${USER_OF("other", "partner_user", OTHER_PARTNER)}
        do $$ begin
          raise notice 'R|have|%|%|%', current_setting('t.ops') <> '', current_setting('t.owner') <> '', current_setting('t.other') <> '';
        end $$;
        ${SEATS}
        ${booking(14, { seat: 1, partner: PARTNER })}
        ${job(14, 14)}
        ${signedInAs(TECH)}
        select public.record_installation_seat_scan('${jobId(14)}', 'serial', 'KP-SEAT-1');
        ${asRpc("app.booking_change", `update public.bookings set status = 'family_ready' where id = '${bookingId(14)}';`)}
        set local role authenticated;
        ${readAs("ops", "ops")}
        ${readAs("owner", "owner")}
        ${readAs("other", "other")}
        select set_config('t.nobody', '', true);
        ${readAs("nobody", "nobody")}
        select set_config('request.jwt.claim.sub', current_setting('t.ops'), true);
        do $$ begin
          insert into public.installation_seat_scans (technician_job_id, assigned_seat_id, matched)
          values ('${jobId(14)}', '${seatId(1)}', true);
          raise notice 'R|insert|ok';
        exception when others then
          raise notice 'R|insert|%', sqlstate;
        end $$;`)
    : [];

  it("should have an operations manager and a partner user for each of the two partners", () => {
    expect(result(rows, "have")).toBe("true|true|true");
  });

  it("should show an operations manager and the partner user of the booking the scan, the deadline and the Family Ready moment", () => {
    expect(result(rows, "ops")).toBe("1|1|1");
    expect(result(rows, "owner")).toBe("1|1|1");
  });

  it("should show a partner user of another partner, and nobody signed in, nothing", () => {
    expect(result(rows, "other")).toBe("0|0|0");
    expect(result(rows, "nobody")).toBe("0|0|0");
  });

  it("should not let any signed-in user write to the scan log directly", () => {
    expect(result(rows, "insert")).toBe("42501");
  });
});
