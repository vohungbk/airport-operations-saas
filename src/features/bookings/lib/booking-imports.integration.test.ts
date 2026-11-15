import { describe, expect, it } from "vitest";

import {
  AIRPORT,
  CATEGORY,
  USER,
  asUser,
  available,
  newPartner,
  partnerId,
  run,
} from "@/lib/finance/finance-test-support";

/**
 * CO-F07-S04, S05: import_bookings() creates the rows of an import through create_booking(), links them to
 * the import, records the source CSV in the "created" event, and rejects a row whose external booking number
 * the partner already has (R9, E4). booking_imports is read by an admin and an operations manager only and is
 * never written by a user directly (RLS). The function reads the caller from the JWT claim, so each call sets
 * `request.jwt.claim.sub`; the RLS checks switch to the `authenticated` role. Every scenario runs in a
 * transaction that is rolled back and makes its own partner. Skipped when the local stack is not running.
 */
const row = (n: number, external: string | null) => ({
  row_number: n,
  seat_category_id: CATEGORY,
  pickup_at: "2030-01-01T10:00:00Z",
  return_at: "2030-01-04T10:00:00Z",
  daily_rate: 90,
  ...(external ? { external_booking_number: external } : {}),
});

/** Imports the rows as a role and reports `R|name|<created>|<rejected>|<first reason>` or `R|name|<sqlstate>`. */
const importRows = (name: string, role: string, partner: number, rows: unknown[], total = rows.length) => `
  ${asUser(role)}
  do $$ declare r jsonb; begin
    r := public.import_bookings('${partnerId(partner)}', '${AIRPORT}', 'bookings.csv', 120, ${total}, '${JSON.stringify(rows)}'::jsonb);
    raise notice 'R|${name}|%|%|%', jsonb_array_length(r->'created'), jsonb_array_length(r->'rejected'), coalesce(r->'rejected'->0->>'reason', 'none');
  exception when others then
    raise notice 'R|${name}|%', sqlstate;
  end $$;`;

const get = (rows: string[][], name: string) => {
  const found = rows.find((r) => r[0] === name);
  expect(found, name).toBeDefined();
  return found!.slice(1);
};

describe.skipIf(!available)("import bookings (CO-F07-S04, S05)", () => {
  it("should create the valid rows, link them to the import and record the source CSV (S05, R14)", () => {
    const rows = run(`
      ${newPartner(41)}
      ${importRows("import", "operations_manager", 41, [row(1, "EXT-1"), row(2, "EXT-2")], 3)}
      do $$ declare c integer; e integer; i text; begin
        select count(*) into c from public.bookings b
         where b.partner_id = '${partnerId(41)}' and b.import_id is not null;
        select count(*) into e from public.booking_events ev join public.bookings b on b.id = ev.booking_id
         where b.partner_id = '${partnerId(41)}' and ev.metadata->>'event_type' = 'created' and ev.metadata->>'source' = 'csv'
           and ev.metadata->>'import_id' = b.import_id::text;
        select created_rows || '/' || rejected_rows into i from public.booking_imports where partner_id = '${partnerId(41)}';
        raise notice 'R|state|%|%|%', c, e, i;
      end $$;`);

    expect(get(rows, "import")).toEqual(["2", "0", "none"]);
    expect(get(rows, "state")).toEqual(["2", "2", "2/1"]);
  });

  it("should reject a row that repeats an external booking number the partner already has, and change nothing (S04, R9)", () => {
    const rows = run(`
      ${newPartner(42)}
      ${importRows("first", "operations_manager", 42, [row(1, "EXT-1")])}
      ${importRows("again", "operations_manager", 42, [row(1, "EXT-1"), row(2, null)])}
      do $$ declare c integer; begin
        select count(*) into c from public.bookings where partner_id = '${partnerId(42)}';
        raise notice 'R|count|%', c;
      end $$;`);

    expect(get(rows, "first")).toEqual(["1", "0", "none"]);
    expect(get(rows, "again")).toEqual(["1", "1", "Duplicate external booking number"]);
    expect(get(rows, "count")).toEqual(["2"]);
  });

  it.each(["partner_user", "technician"])("should refuse an import from a %s (S05)", (role) => {
    const rows = run(`
      ${newPartner(43)}
      ${importRows("import", role, 43, [row(1, "EXT-1")])}`);

    expect(get(rows, "import")).toEqual(["42501"]);
  });

  it("should show the imports to an operations manager and none to a partner user, and let nobody write one directly (RLS)", () => {
    const rows = run(`
      ${newPartner(44)}
      ${importRows("import", "operations_manager", 44, [row(1, "EXT-1")])}
      do $$ declare ops integer; partner integer; begin
        perform set_config('request.jwt.claim.sub', coalesce(${USER("operations_manager")}, ''), true);
        set local role authenticated;
        select count(*) into ops from public.booking_imports where partner_id = '${partnerId(44)}';
        reset role;
        perform set_config('request.jwt.claim.sub', coalesce(${USER("partner_user")}, ''), true);
        set local role authenticated;
        select count(*) into partner from public.booking_imports where partner_id = '${partnerId(44)}';
        reset role;
        raise notice 'R|read|%|%', ops, partner;
      end $$;
      do $$ begin
        perform set_config('request.jwt.claim.sub', coalesce(${USER("operations_manager")}, ''), true);
        set local role authenticated;
        insert into public.booking_imports (partner_id, airport_id, file_name, file_size_bytes, total_rows)
        values ('${partnerId(44)}', '${AIRPORT}', 'forged.csv', 1, 1);
        reset role;
        raise notice 'R|write|ok';
      exception when others then
        reset role;
        raise notice 'R|write|%', sqlstate;
      end $$;`);

    expect(get(rows, "read")).toEqual(["1", "0"]);
    expect(get(rows, "write")).toEqual(["42501"]);
  });
  it("should create the rows beyond the stock without a seat and flag only those for allocation (S06, E5)", () => {
    const rows = run(`
      ${newPartner(45)}
      ${asUser("operations_manager")}
      do $$ declare n integer; r jsonb; begin
        select count(*) into n from public.seats s
         where s.airport_id = '${AIRPORT}' and s.category_id = '${CATEGORY}' and s.status = 'available';
        -- one row more than there are seats: all rows ask for the same days
        select jsonb_agg(jsonb_build_object(
          'row_number', g, 'seat_category_id', '${CATEGORY}', 'pickup_at', '2031-03-01T10:00:00Z',
          'return_at', '2031-03-04T10:00:00Z', 'daily_rate', 90)) into r from generate_series(1, n + 1) g;
        perform public.import_bookings('${partnerId(45)}', '${AIRPORT}', 'stock.csv', 120, n + 1, r);
        raise notice 'R|stock|%', n;
      end $$;
      do $$ declare c integer; f integer; s integer; begin
        select count(*) into c from public.bookings where partner_id = '${partnerId(45)}';
        select count(*) into f from public.booking_events ev join public.bookings b on b.id = ev.booking_id
         where b.partner_id = '${partnerId(45)}' and ev.metadata->>'event_type' = 'created' and ev.metadata->>'allocation' = 'needed';
        select count(*) into s from public.bookings where partner_id = '${partnerId(45)}' and assigned_seat_id is not null;
        raise notice 'R|state|%|%|%', c, f, s;
      end $$;`);

    const [seats] = get(rows, "stock");
    expect(get(rows, "state")).toEqual([String(Number(seats) + 1), "1", "0"]);
  });
});
