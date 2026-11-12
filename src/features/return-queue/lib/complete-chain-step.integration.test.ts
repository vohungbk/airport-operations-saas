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
import {
  RECORDED_CHAIN_STEPS,
  RETURN_CHAIN_CHECKLIST,
  type RecordedChainStep,
} from "@/features/return-queue/lib/return-chain";

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

/** Every checklist item of a step ticked, as a SQL jsonb literal. */
const checklist = (step: RecordedChainStep) =>
  `'${JSON.stringify(Object.fromEntries(RETURN_CHAIN_CHECKLIST[step].map((item) => [item.id, true])))}'`;


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
    from unnest(array[${RECORDED_CHAIN_STEPS.map((step) => `'${step}'`).join(", ")}]) s;`;

/** Completes a step as a user and reports `R|name|ok` or `R|name|<sqlstate>|<detail>`. */
const complete = (
  name: string,
  user: string,
  step: RecordedChainStep,
  result = "pass",
  notes = "null",
  photos = `array['${photo(step)}']`,
) => `
  select set_config('request.jwt.claim.sub', coalesce(${user}, ''), true);
  set local role authenticated;
  do $$ declare d text; begin
    perform public.complete_return_chain_step('${bookingId(1)}', '${step}', '${result}', ${checklist(step)}, ${notes}, ${photos});
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

/**
 * FO-F08-S06 (R6, E7): a pass on the final inspection completes the booking and adds a rental
 * cycle; the seat becomes available, or goes to quarantine when it reaches its maximum cycles.
 */
describe.skipIf(!available)("return the seat to available after the final inspection (FO-F08-S06)", () => {
  /** Reports `R|name|<booking status>|<seat status>|<rental cycles>|<quarantine reason>`. */
  const seatAfter = (name: string) => `
    do $$ declare b text; s public.seats; begin
      select status::text into b from public.bookings where id = '${bookingId(1)}';
      select * into s from public.seats st where st.id = ${SEAT};
      raise notice 'R|${name}|%|%|%|%', b, s.status, s.rental_cycles, coalesce(s.quarantine_reason, '');
    end $$;`;

  it.each([
    ["become available with one more rental cycle when below its maximum", 3, ["completed", "available", "4", ""]],
    ["go to quarantine for retirement when it reaches its maximum rental cycles", 4, ["completed", "quarantine", "5", "Reached max rental cycles"]],
  ])("should let the seat %s", (_, cycles, expected) => {
    const rows = run(`
      ${setup}
      update public.seats set rental_cycles = ${cycles}, max_rental_cycles = 5 where id = ${SEAT};
      ${RECORDED_CHAIN_STEPS.map((step) => complete(step, OPS, step)).join("\n")}
      ${seatAfter("after")}`);

    RECORDED_CHAIN_STEPS.forEach((step) => expect(get(rows, step)).toEqual(["ok"]));
    expect(get(rows, "after")).toEqual(expected);
  });
});

/**
 * FO-F08-S07 (AC01, R7): the seat status follows each completed step of the chain, and (AC02, R10)
 * a booking that holds the seat in a conflicting period stops the chain from starting or
 * completing, by the conflict rule of FO-F03.
 */
describe.skipIf(!available)("follow the seat status through the return chain (FO-F08-S07)", () => {
  /** Another pending booking of the same seat, picked up `startsIn` from now for one day. */
  const otherBooking = (startsIn: string) => `
    insert into public.bookings (id, booking_number, partner_id, airport_id, pickup_at, return_at, seat_category_id, daily_rate, assigned_seat_id)
    values ('${bookingId(2)}', 'RC-2', '${partnerId(1)}', '${AIRPORT}', now() + interval '${startsIn}', now() + interval '${startsIn}' + interval '1 day', '${CATEGORY}', 90, ${SEAT});`;

  const stepsBeforeLast = RECORDED_CHAIN_STEPS.filter((step) => step !== "final_inspection");

  it("should move the seat to the status of each step until it is available (AC01)", () => {
    const rows = run(`
      ${setup}
      update public.seats set rental_cycles = 0, max_rental_cycles = 100 where id = ${SEAT};
      ${RECORDED_CHAIN_STEPS.map((step) => `${complete(step, OPS, step)}\n${state(`after-${step}`)}`).join("\n")}`);

    expect(RECORDED_CHAIN_STEPS.map((step) => get(rows, `after-${step}`).slice(0, 2))).toEqual([
      ["returned", "inspection"],
      ["cleaning", "cleaning"],
      ["cleaning", "cleaning"],
      ["cleaning", "cleaning"],
      ["inspection", "inspection"],
      ["completed", "available"],
    ]);
  });

  it("should refuse to start the chain while another booking holds the seat in the period and change nothing (AC02)", () => {
    const rows = run(`
      ${setup}
      ${otherBooking("1 hour")}
      ${complete("start", OPS, "returned")}
      ${state("after")}`);

    expect(get(rows, "start")[0]).toBe("RC002");
    expect(get(rows, "after")).toEqual(["returned", "available", "0"]);
  });

  it("should refuse to complete the chain while another booking holds the seat in the period and change nothing (AC02)", () => {
    const rows = run(`
      ${setup}
      ${stepsBeforeLast.map((step) => complete(step, OPS, step)).join("\n")}
      ${otherBooking("1 hour")}
      ${complete("final", OPS, "final_inspection")}
      ${state("after")}`);

    expect(get(rows, "final")[0]).toBe("RC002");
    expect(get(rows, "after")).toEqual(["inspection", "inspection", String(stepsBeforeLast.length)]);
  });

  it.each([
    ["start the chain when the other booking starts after the period", `${otherBooking("3 hours")}`, "returned"],
    [
      "complete a step in the middle of the chain",
      `${complete("start", OPS, "returned")}\n${otherBooking("1 hour")}`,
      "initial_inspection",
    ],
  ] as const)("should %s (AC02)", (_, before, step) => {
    const rows = run(`
      ${setup}
      ${before}
      ${complete("step", OPS, step)}`);

    expect(get(rows, "step")).toEqual(["ok"]);
  });
});
