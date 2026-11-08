import { describe, expect, it } from "vitest";

import { PARTNER, available, run } from "@/lib/finance/finance-test-support";

/**
 * VI-F05-S05: the baseline inputs of a partner. A partner user saves and reads the baseline of its own
 * partner; a partner user of another partner cannot read it; a technician, an admin and an operations
 * manager cannot save one (the admin and the operations manager read it); and nobody writes the table
 * directly. Values outside the rules are refused by the database. Every scenario runs with the real RLS
 * of each role, in a transaction that is rolled back. Needs a partner user for each of the two seed
 * partners, a technician, an admin and an operations manager (present after `npm run demo:reset`).
 * Skipped when the local stack is not running.
 */
const OTHER_PARTNER = "b0000000-0000-0000-0000-000000000002";

const USER_OF = (name: string, role: string, partner: string | null) => `
  select set_config('t.${name}', coalesce(
    (select id::text from public.users u where u.role = '${role}' and u.is_active
       ${partner ? `and u.partner_id = '${partner}'` : ""} order by u.email limit 1), ''), true);`;

const signedInAs = (name: string) => `select set_config('request.jwt.claim.sub', current_setting('t.${name}'), true);`;

const DEFAULTS: Record<string, string> = {
  monthly_staff_cost: "2400",
  handling_cost_per_rental: "5",
  monthly_inventory_cost: "1500",
  programme_inventory_cost: "700",
  owned_seats: "40",
  average_handling_minutes: "20",
  hourly_staff_cost: "15",
  expected_programme_handling_minutes: "10",
  average_daily_price: "20",
  average_paid_days: "5",
  baseline_conversion_percent: "12",
  programme_conversion_percent: "15",
  qualified_enquiries: "1000",
  average_contribution_per_rental: "50",
};

/** Calls the save function with the values above, changed by `change`, and reports `ok` or the SQLSTATE. */
const save = (label: string, change: Record<string, string> = {}) => {
  const values = { ...DEFAULTS, ...change };
  const args = Object.entries(values)
    .map(([name, value]) => `p_${name} => ${value}`)
    .join(", ");

  return `
    do $$ begin
      perform public.save_partner_baseline_inputs(${args});
      raise notice 'R|${label}|ok';
    exception when others then
      raise notice 'R|${label}|%', sqlstate;
    end $$;`;
};

/** Reports how many baseline rows of the partner the signed-in user sees, and the seats of the first. */
const read = (label: string, partner: string) => `
  do $$ declare n integer; seats integer; begin
    select count(*), max(owned_seats) into n, seats from public.partner_baseline_inputs where partner_id = '${partner}';
    raise notice 'R|${label}|%|%', n, coalesce(seats::text, '-');
  end $$;`;

/** Tries a statement the table does not allow, and reports the SQLSTATE. */
const tryWrite = (label: string, statement: string) => `
  do $$ begin
    ${statement}
    raise notice 'R|${label}|ok';
  exception when others then
    raise notice 'R|${label}|%', sqlstate;
  end $$;`;

describe.skipIf(!available)("the baseline inputs of a partner (VI-F05-S05)", () => {
  const rows = available
    ? run(`
        ${USER_OF("owner", "partner_user", PARTNER)}
        ${USER_OF("other", "partner_user", OTHER_PARTNER)}
        ${USER_OF("tech", "technician", null)}
        ${USER_OF("admin", "admin", null)}
        ${USER_OF("ops", "operations_manager", null)}
        do $$ begin
          raise notice 'R|have|%|%|%|%|%', current_setting('t.owner') <> '', current_setting('t.other') <> '',
            current_setting('t.tech') <> '', current_setting('t.admin') <> '', current_setting('t.ops') <> '';
        end $$;
        set local role authenticated;

        ${signedInAs("owner")}
        ${read("owner_before", PARTNER)}
        ${save("owner_save")}
        ${read("owner_read", PARTNER)}
        do $$ declare saver uuid; begin
          select updated_by into saver from public.partner_baseline_inputs where partner_id = '${PARTNER}';
          raise notice 'R|owner_saved_by|%|%', saver = current_setting('t.owner')::uuid,
            (select updated_at is not null from public.partner_baseline_inputs where partner_id = '${PARTNER}');
        end $$;
        ${save("owner_save_again", { owned_seats: "50" })}
        ${read("owner_read_again", PARTNER)}

        ${save("neg_amount", { monthly_staff_cost: "-1" })}
        ${save("amount_3_decimals", { handling_cost_per_rental: "5.005" })}
        ${save("neg_seats", { owned_seats: "-1" })}
        ${save("conversion_above_100", { programme_conversion_percent: "100.01" })}
        ${save("conversion_below_0", { baseline_conversion_percent: "-0.01" })}
        ${save("conversion_100", { baseline_conversion_percent: "100", owned_seats: "50" })}
        ${save("missing_value", { qualified_enquiries: "null" })}
        ${read("owner_after_refused", PARTNER)}

        ${tryWrite(
          "direct_insert",
          `insert into public.partner_baseline_inputs (partner_id, monthly_staff_cost, handling_cost_per_rental, monthly_inventory_cost,
             programme_inventory_cost, owned_seats, average_handling_minutes, hourly_staff_cost, expected_programme_handling_minutes,
             average_daily_price, average_paid_days, baseline_conversion_percent, programme_conversion_percent, qualified_enquiries,
             average_contribution_per_rental) values ('${OTHER_PARTNER}', 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1);`,
        )}
        ${tryWrite("direct_update", `update public.partner_baseline_inputs set owned_seats = 1 where partner_id = '${PARTNER}';`)}
        ${tryWrite("direct_delete", `delete from public.partner_baseline_inputs where partner_id = '${PARTNER}';`)}

        ${signedInAs("other")}
        ${read("other_reads_owner", PARTNER)}
        ${save("other_save")}
        ${read("other_reads_own", OTHER_PARTNER)}
        ${read("other_reads_owner_after", PARTNER)}

        ${signedInAs("tech")}
        ${read("tech_read", PARTNER)}
        ${save("tech_save")}

        ${signedInAs("admin")}
        ${read("admin_read", PARTNER)}
        ${read("admin_reads_other", OTHER_PARTNER)}
        ${save("admin_save")}

        ${signedInAs("ops")}
        ${read("ops_read", PARTNER)}
        ${save("ops_save")}

        reset role;
        select set_config('request.jwt.claim.sub', '', true);
        set local role anon;
        ${read("anon_read", PARTNER)}
        ${save("anon_save")}`)
    : [];

  const get = (name: string) => rows.find((r) => r[0] === name)?.slice(1);

  it("should have a partner user for each partner, a technician, an admin and an operations manager", () => {
    expect(get("have")).toEqual(["true", "true", "true", "true", "true"]);
  });

  it("should start with no baseline, so the screen is empty (Empty)", () => {
    expect(get("owner_before")).toEqual(["0", "-"]);
  });

  it("should let a partner user save the baseline of its own partner and read it back (AC06)", () => {
    expect(get("owner_save")).toEqual(["ok"]);
    expect(get("owner_read")).toEqual(["1", "40"]);
  });

  it("should save the time and the user who saved it (AC06)", () => {
    expect(get("owner_saved_by")).toEqual(["true", "true"]);
  });

  it("should replace the baseline on a new save, keeping one row per partner", () => {
    expect(get("owner_save_again")).toEqual(["ok"]);
    expect(get("owner_read_again")).toEqual(["1", "50"]);
  });

  it.each([
    ["neg_amount", "BL001"],
    ["amount_3_decimals", "BL001"],
    ["neg_seats", "BL002"],
    ["conversion_above_100", "BL003"],
    ["conversion_below_0", "BL003"],
    ["missing_value", "22023"],
  ])("should refuse %s with %s in the database (AC03 to AC05)", (label, state) => {
    expect(get(label)).toEqual([state]);
  });

  it("should accept a conversion of exactly 100 (AC05)", () => {
    expect(get("conversion_100")).toEqual(["ok"]);
  });

  it("should keep the earlier baseline when a save is refused", () => {
    expect(get("owner_after_refused")?.[0]).toBe("1");
  });

  it("should refuse every direct write to the table, for a partner user too", () => {
    expect(get("direct_insert")).toEqual(["42501"]);
    expect(get("direct_update")).toEqual(["42501"]);
    expect(get("direct_delete")).toEqual(["42501"]);
  });

  it("should show a partner user of another partner nothing of this baseline (cross-tenant denial)", () => {
    expect(get("other_reads_owner")).toEqual(["0", "-"]);
    expect(get("other_reads_owner_after")).toEqual(["0", "-"]);
  });

  it("should save a baseline for the partner of the caller only, never for the partner of someone else", () => {
    expect(get("other_save")).toEqual(["ok"]);
    expect(get("other_reads_own")).toEqual(["1", "40"]);
    expect(get("admin_read")?.[1]).toBe("50");
  });

  it("should show a technician nothing and refuse its save", () => {
    expect(get("tech_read")).toEqual(["0", "-"]);
    expect(get("tech_save")).toEqual(["42501"]);
  });

  it("should let an admin and an operations manager read every baseline but not save one", () => {
    expect(get("admin_read")?.[0]).toBe("1");
    expect(get("admin_reads_other")?.[0]).toBe("1");
    expect(get("ops_read")?.[0]).toBe("1");
    expect(get("admin_save")).toEqual(["42501"]);
    expect(get("ops_save")).toEqual(["42501"]);
  });

  it("should give a signed-out caller no access", () => {
    expect(get("anon_read")?.[0]).not.toBe("1");
    expect(get("anon_save")).toEqual(["42501"]);
  });
});
