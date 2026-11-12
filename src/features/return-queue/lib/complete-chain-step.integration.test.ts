import { describe, expect, it } from "vitest";

import {
  AIRPORT,
  CATEGORY,
  USER,
  available,
  bookingId,
  newPartner,
  partnerId,
  run,
} from "@/lib/finance/finance-test-support";

/**
 * FO-F08-S02 (AC06, AC09, R3 to R7, E1, E4): complete_return_chain_step() stores a step with the
 * actor and the time and moves the seat; the steps are read by internal roles only. Every
 * scenario runs in a transaction that is rolled back and makes its own partner and booking.
 * Skipped when the local stack is not running, like the RLS suite.
 */
const OPS = USER("operations_manager");
const TECHNICIAN = USER("technician");
// A partner user of another partner than the booking's: the tenant boundary.
const PARTNER_USER = USER("partner_user");

const SEAT = `(select s.id from public.seats s where s.airport_id = '${AIRPORT}' and s.category_id = '${CATEGORY}' and s.status <> 'retired' order by s.serial_number limit 1)`;

const CHECKLIST: Record<string, string> = {
  returned: `'{"seat_received": true, "serial_matches": true, "parts_returned": true}'`,
  initial_inspection: `'{"shell_checked": true, "harness_checked": true, "buckle_checked": true}'`,
  cleaning: `'{"shell_cleaned": true, "harness_cleaned": true, "straps_cleaned": true}'`,
};

const photo = (step: string) => `${bookingId(1)}/${step}/p-1.jpg`;

/** A returned booking of its own partner with the seat, and a stored photo per step (as the owner). */
const setup = `
  ${newPartner(1)}
  insert into public.bookings (id, booking_number, partner_id, airport_id, pickup_at, return_at, seat_category_id, daily_rate, assigned_seat_id, assigned_technician_id)
  values ('${bookingId(1)}', 'RC-1', '${partnerId(1)}', '${AIRPORT}', '2030-01-01 10:00:00+00', '2030-01-04 10:00:00+00', '${CATEGORY}', 90, ${SEAT}, ${TECHNICIAN}::uuid);
  select set_config('app.booking_change', 'on', true);
  update public.bookings set status = 'returned' where id = '${bookingId(1)}';
  select set_config('app.booking_change', '', true);
  select set_config('app.seat_status_change', 'on', true);
  update public.seats set status = 'available', quarantine_reason = null where id = ${SEAT};
  select set_config('app.seat_status_change', '', true);
  insert into storage.objects (bucket_id, name)
  select 'return-chain-photos', '${bookingId(1)}/' || s || '/p-1.jpg'
    from unnest(array['returned', 'initial_inspection', 'cleaning']) s;`;

/** Completes a step as a user and reports `R|name|ok` or `R|name|<sqlstate>|<detail>`. */
const complete = (
  name: string,
  user: string,
  step: string,
  result = "pass",
  notes = "null",
  photos = `array['${photo(step)}']`,
) => `
  select set_config('request.jwt.claim.sub', coalesce(${user}, ''), true);
  set local role authenticated;
  do $$ declare d text; begin
    perform public.complete_return_chain_step('${bookingId(1)}', '${step}', '${result}', ${CHECKLIST[step] ?? "'{}'"}, ${notes}, ${photos});
    raise notice 'R|${name}|ok';
  exception when others then
    get stacked diagnostics d = pg_exception_detail;
    raise notice 'R|${name}|%|%', sqlstate, coalesce(d, '');
  end $$;
  reset role;`;

/** Reports `R|name|<booking status>|<seat status>|<recorded steps>`. */
const state = (name: string) => `
  do $$ declare b text; s text; c integer; begin
    select status::text into b from public.bookings where id = '${bookingId(1)}';
    select st.status::text into s from public.seats st where st.id = ${SEAT};
    select count(*) into c from public.return_chain_steps where booking_id = '${bookingId(1)}';
    raise notice 'R|${name}|%|%|%', b, s, c;
  end $$;`;

/** Reports how many steps of the booking a user reads: `R|name|<count>`. */
const readAs = (name: string, user: string) => `
  select set_config('request.jwt.claim.sub', coalesce(${user}, ''), true);
  set local role authenticated;
  do $$ declare c integer; begin
    select count(*) into c from public.return_chain_steps where booking_id = '${bookingId(1)}';
    raise notice 'R|${name}|%', c;
  end $$;
  reset role;`;

const get = (rows: string[][], name: string) => {
  const row = rows.find((r) => r[0] === name);
  expect(row, name).toBeDefined();
  return row!.slice(1);
};

describe.skipIf(!available)("complete a step of the return chain (FO-F08-S02)", () => {
  it("should store each step with the actor, time, checklist, result and photo, and move the seat (AC06, AC09)", () => {
    const rows = run(`
      ${setup}
      ${complete("returned", OPS, "returned")}
      ${state("after-returned")}
      ${complete("initial", OPS, "initial_inspection")}
      ${state("after-initial")}
      do $$ declare r record; begin
        select * into r from public.return_chain_steps where booking_id = '${bookingId(1)}' and step = 'returned';
        raise notice 'R|stored|%|%|%|%|%', r.completed_by = ${OPS}::uuid, r.completed_at is not null,
          r.checklist ->> 'seat_received', r.result, array_length(r.photo_paths, 1);
      end $$;`);

    expect(get(rows, "returned")).toEqual(["ok"]);
    expect(get(rows, "after-returned")).toEqual(["returned", "inspection", "1"]);
    expect(get(rows, "initial")).toEqual(["ok"]);
    expect(get(rows, "after-initial")).toEqual(["cleaning", "cleaning", "2"]);
    expect(get(rows, "stored")).toEqual(["t", "t", "true", "pass", "1"]);
  });

  it("should refuse a step out of order or completed twice, naming the step the seat is at (E1, E4)", () => {
    const rows = run(`
      ${setup}
      ${complete("skip", OPS, "cleaning")}
      ${complete("first", OPS, "returned")}
      ${complete("twice", OPS, "returned")}
      ${state("after")}`);

    expect(get(rows, "skip")).toEqual(["RC001", "returned"]);
    expect(get(rows, "first")).toEqual(["ok"]);
    expect(get(rows, "twice")).toEqual(["RC001", "initial_inspection"]);
    expect(get(rows, "after")).toEqual(["returned", "inspection", "1"]);
  });

  it("should send the seat to quarantine on a failed step and stop the chain (R5)", () => {
    const rows = run(`
      ${setup}
      ${complete("fail-no-notes", OPS, "returned", "fail")}
      ${complete("fail", OPS, "returned", "fail", "'Cracked shell'")}
      ${state("after")}
      ${complete("next", OPS, "initial_inspection")}`);

    expect(get(rows, "fail-no-notes")[0]).toBe("22023");
    expect(get(rows, "fail")).toEqual(["ok"]);
    expect(get(rows, "after")).toEqual(["returned", "quarantine", "1"]);
    expect(get(rows, "next")[0]).toBe("55000");
  });

  it("should refuse a step without a stored photo of that step (AC05)", () => {
    const rows = run(`
      ${setup}
      ${complete("none", OPS, "returned", "pass", "null", "array[]::text[]")}
      ${complete("other-step", OPS, "returned", "pass", "null", `array['${photo("cleaning")}']`)}
      ${complete("not-stored", OPS, "returned", "pass", "null", `array['${bookingId(1)}/returned/missing.jpg']`)}`);

    expect(get(rows, "none")[0]).toBe("22023");
    expect(get(rows, "other-step")[0]).toBe("22023");
    expect(get(rows, "not-stored")[0]).toBe("22023");
  });

  it("should not let a partner user or a technician read, write or complete steps (cross-tenant denial)", () => {
    const rows = run(`
      ${setup}
      ${complete("ops", OPS, "returned")}
      ${readAs("read-ops", OPS)}
      ${readAs("read-partner", PARTNER_USER)}
      ${readAs("read-technician", TECHNICIAN)}
      ${complete("partner", PARTNER_USER, "initial_inspection")}
      ${complete("technician", TECHNICIAN, "initial_inspection")}
      select set_config('request.jwt.claim.sub', coalesce(${OPS}, ''), true);
      set local role authenticated;
      do $$ begin
        insert into public.return_chain_steps (booking_id, seat_id, step, result, checklist, photo_paths, completed_by)
        values ('${bookingId(1)}', ${SEAT}, 'initial_inspection', 'pass', '{}', array['x'], ${OPS}::uuid);
        raise notice 'R|insert|ok';
      exception when others then
        raise notice 'R|insert|%', sqlstate;
      end $$;
      do $$ begin
        delete from public.return_chain_steps where booking_id = '${bookingId(1)}';
        raise notice 'R|delete|ok';
      exception when others then
        raise notice 'R|delete|%', sqlstate;
      end $$;
      reset role;
      ${state("after")}`);

    expect(get(rows, "ops")).toEqual(["ok"]);
    expect(get(rows, "read-ops")).toEqual(["1"]);
    expect(get(rows, "read-partner")).toEqual(["0"]);
    expect(get(rows, "read-technician")).toEqual(["0"]);
    expect(get(rows, "partner")[0]).toBe("42501");
    expect(get(rows, "technician")[0]).toBe("42501");
    expect(get(rows, "insert")).toEqual(["42501"]);
    expect(get(rows, "delete")).toEqual(["42501"]);
    expect(get(rows, "after")).toEqual(["returned", "inspection", "1"]);
  });
});
