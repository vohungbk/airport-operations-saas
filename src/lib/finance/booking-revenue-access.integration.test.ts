import { describe, expect, it } from "vitest";

import { FLAG_ON, PARTNER, available, insertBooking, run } from "@/lib/finance/finance-test-support";

/**
 * VI-F04-S08 (spec R3): the revenue of a booking is shown within scope. This reads the revenue
 * columns and the terms the booking used with the real RLS of each role, in a transaction that is
 * rolled back: an operations manager sees the booking, a partner user of its own partner sees it,
 * a partner user of another partner sees nothing, not even the terms. Needs an operations manager
 * and a partner user for each of the two seed partners (present after `npm run demo:reset`, and once
 * the RLS suite has run). Skipped when the local stack is not running.
 */
const OTHER_PARTNER = "b0000000-0000-0000-0000-000000000002";
const ID = "d7000000-0000-0000-0000-000000000001";

const USER_OF = (name: string, role: string, partner: string | null) => `
  select set_config('t.${name}', coalesce(
    (select id::text from public.users u where u.role = '${role}' and u.is_active
       ${partner ? `and u.partner_id = '${partner}'` : ""} order by u.email limit 1), ''), true);`;

/** What the given user can read of the booking and of the terms it used. */
const readAs = (name: string, key: string) => `
  select set_config('request.jwt.claim.sub', current_setting('t.${key}'), true);
  do $$ declare n_bookings integer; n_terms integer; n_revenue numeric; begin
    select count(*), count(t.id), max(b.gross_revenue)
      into n_bookings, n_terms, n_revenue
      from public.bookings b
      left join public.partner_commercial_terms t on t.id = b.commercial_terms_id
     where b.id = '${ID}';
    raise notice 'R|${name}|%|%|%', n_bookings, n_terms, coalesce(n_revenue::text, 'null');
  end $$;`;

describe.skipIf(!available)("who can read the revenue of a booking (VI-F04-S08, spec R3)", () => {
  const rows = available
    ? run(`
        ${USER_OF("ops", "operations_manager", null)}
        ${USER_OF("owner", "partner_user", PARTNER)}
        ${USER_OF("other", "partner_user", OTHER_PARTNER)}
        ${USER_OF("tech", "technician", null)}
        do $$ begin
          raise notice 'R|have|%|%|%|%', current_setting('t.ops') <> '', current_setting('t.owner') <> '',
            current_setting('t.other') <> '', current_setting('t.tech') <> '';
        end $$;
        ${insertBooking(ID, "2030-01-01 10:00:00+00", "2030-01-04 10:00:00+00", "90")}
        ${FLAG_ON}
        update public.bookings set status = 'completed' where id = '${ID}';
        set local role authenticated;
        ${readAs("ops", "ops")}
        ${readAs("owner", "owner")}
        ${readAs("other", "other")}
        ${readAs("tech", "tech")}`)
    : [];

  const get = (name: string) => rows.find((r) => r[0] === name)?.slice(1);

  it("should have the users it needs: an operations manager, a partner user of each partner, a technician", () => {
    expect(get("have")).toEqual(["t", "t", "t", "t"]);
  });

  it("should show an operations manager the booking, its revenue and the terms it used (AC02)", () => {
    expect(get("ops")).toEqual(["1", "1", "270.00"]);
  });

  it("should show a partner user the booking of its own partner, with its revenue and its terms (AC02)", () => {
    expect(get("owner")).toEqual(["1", "1", "270.00"]);
  });

  it("should show a partner user of another partner nothing: no booking, no terms, no revenue (cross-tenant denial)", () => {
    expect(get("other")).toEqual(["0", "0", "null"]);
  });

  it("should show a technician nothing of the revenue of a booking that is not theirs", () => {
    expect(get("tech")).toEqual(["0", "0", "null"]);
  });
});
