import { describe, expect, it } from "vitest";

import { STEP_DEADLINE_HOURS, isBookingOverdue } from "@/features/bookings/lib/booking-deadlines";
import { BOOKING_STATUSES } from "@/features/bookings/lib/booking-status";
import { available, run } from "@/lib/finance/finance-test-support";

/**
 * CO-F08-S07 (AC01): the deadline of each step and the overdue rule in the database are the same as
 * the table in booking-deadlines.ts. The functions read no table, so there is no data to make and
 * nothing for row-level security to hide. Skipped when the local stack is not running.
 */
const PICKUP = "2030-01-10 12:00:00+00";
const STEPS = BOOKING_STATUSES;
const NOW_VALUES = ["2030-01-08 12:00:00+00", "2030-01-09 12:00:00+00", "2030-01-09 12:00:01+00", "2030-01-10 07:00:00+00", "2030-01-10 08:00:01+00", "2030-01-10 11:30:00+00"];

const result = (rows: string[][], name: string) => rows.find((row) => row[0] === name)?.[1];

describe.skipIf(!available)("booking step deadlines (CO-F08-S07)", () => {
  it("should hold the same hours before pickup for each step as the TypeScript table", () => {
    const rows = run(
      STEPS.map(
        (step) =>
          `do $$ begin raise notice 'R|${step}|%', coalesce((extract(epoch from public.booking_step_deadline_offset('${step}')) / 3600)::text, ''); end $$;`,
      ).join("\n"),
    );

    for (const step of STEPS) {
      const hours = STEP_DEADLINE_HOURS[step];
      expect(result(rows, step), step).toBe(hours === undefined ? "" : String(hours));
    }
  });

  it("should agree with isBookingOverdue for every step and time", () => {
    const calls = STEPS.flatMap((step) =>
      NOW_VALUES.map(
        (now, i) =>
          `do $$ begin raise notice 'R|${step}-${i}|%', public.booking_is_overdue('${step}', '${PICKUP}', '${now}'); end $$;`,
      ),
    );
    const rows = run(calls.join("\n"));

    for (const step of STEPS) {
      NOW_VALUES.forEach((now, i) => {
        const expected = isBookingOverdue(step, PICKUP, new Date(now));
        expect(result(rows, `${step}-${i}`), `${step} at ${now}`).toBe(expected ? "true" : "false");
      });
    }
  });

  it("should not let a signed-out client call the functions", () => {
    const rows = run(`
      set local role anon;
      do $$ begin
        perform public.booking_is_overdue('pending', '${PICKUP}', '${NOW_VALUES[0]}');
        raise notice 'R|anon|ok';
      exception when others then raise notice 'R|anon|%', sqlstate; end $$;`);

    expect(result(rows, "anon")).toBe("42501");
  });
});
