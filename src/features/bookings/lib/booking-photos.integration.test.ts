import { describe, expect, it } from "vitest";

import { AIRPORT, CATEGORY, PARTNER, USER, available, run } from "@/lib/finance/finance-test-support";

/**
 * FO-F06-S01: only an admin or an operations manager adds or reads the photos of a booking; a technician, a
 * partner user and nobody signed in are refused. Every scenario runs in a transaction that is rolled back and
 * makes its own booking and bucket file. Skipped when the local stack is not running.
 */
const BOOKING = "dd000000-0000-0000-0000-000000000001";
const PATH = `${BOOKING}/installation/p-1.jpg`;

const SETUP = `
  insert into public.bookings (id, booking_number, partner_id, airport_id, pickup_at, return_at, seat_category_id, daily_rate)
  values ('${BOOKING}', 'PH-01', '${PARTNER}', '${AIRPORT}', '2033-01-05 10:00:00+00', '2033-01-10 10:00:00+00', '${CATEGORY}', 90);
  insert into storage.objects (bucket_id, name) values ('booking-photos', '${PATH}');`;

const asCaller = (user: string, body: string) => `
  set local role authenticated;
  select set_config('request.jwt.claim.sub', coalesce(${user}, ''), true);
  ${body}
  reset role;`;

const record = (label: string, path = PATH, caption = "'Seat fitted'") => `
  do $$ begin
    perform public.record_booking_photo('${BOOKING}', 'installation', '${path}', ${caption});
    raise notice 'R|${label}|stored';
  exception when others then
    raise notice 'R|${label}|%', sqlstate;
  end $$;`;

const count = (label: string) => `
  do $$ begin
    raise notice 'R|${label}|%', (select count(*) from public.booking_photos);
  end $$;`;

const result = (rows: string[][], label: string) => rows.find((row) => row[0] === label)![1];

describe.skipIf(!available)("booking photos (FO-F06-S01)", () => {
  it("should store a photo with its actor for an operations manager and let them read it back (AC05)", () => {
    const rows = run(`${SETUP} ${asCaller(USER("operations_manager"), `${record("add")} ${count("read")}`)}`);

    expect(result(rows, "add")).toBe("stored");
    expect(result(rows, "read")).toBe("1");
  });

  it.each([["technician"], ["partner_user"]])("should refuse a %s the photo and the read (AC02)", (role) => {
    const rows = run(`
      ${SETUP}
      ${asCaller(USER("operations_manager"), record("seed"))}
      ${asCaller(USER(role), `${record("add")} ${count("read")}`)}`);

    expect(result(rows, "add")).toBe("42501");
    expect(result(rows, "read")).toBe("0");
  });

  it("should refuse nobody signed in, a missing file and a caption over 200 characters (AC03, AC04)", () => {
    const rows = run(`
      ${SETUP}
      ${asCaller("null", record("nobody"))}
      ${asCaller(USER("admin"), `${record("nofile", `${BOOKING}/installation/none.jpg`)} ${record("long", PATH, `'${"a".repeat(201)}'`)}`)}`);

    expect(result(rows, "nobody")).toBe("42501");
    expect(result(rows, "nofile")).toBe("22023");
    expect(result(rows, "long")).toBe("22023");
  });

  it("should give a technician no way to add a file to the bucket", () => {
    const rows = run(`
      ${SETUP}
      ${asCaller(
        USER("technician"),
        `do $$ begin
           insert into storage.objects (bucket_id, name) values ('booking-photos', '${BOOKING}/installation/x.jpg');
           raise notice 'R|file|stored';
         exception when others then
           raise notice 'R|file|%', sqlstate;
         end $$;`,
      )}`);

    expect(result(rows, "file")).not.toBe("stored");
  });
});
