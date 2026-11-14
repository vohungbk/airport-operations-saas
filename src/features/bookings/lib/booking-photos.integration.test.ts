import { describe, expect, it } from "vitest";

import { AIRPORT, CATEGORY, PARTNER, USER, available, run } from "@/lib/finance/finance-test-support";

/**
 * FO-F06-S01, S03: an admin or an operations manager adds or reads the photos of a booking; the assigned
 * technician adds and reads those of their booking; a partner user reads only those of their own partner;
 * anyone else and nobody signed in are refused. Every scenario runs in a transaction that is rolled back and
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

const count = (label: string, from = "public.booking_photos") => `
  do $$ begin
    raise notice 'R|${label}|%', (select count(*) from ${from});
  end $$;`;

const files = (label: string) => count(label, "storage.objects where bucket_id = 'booking-photos'");

const addFile = (label: string) => `
  do $$ begin
    insert into storage.objects (bucket_id, name) values ('booking-photos', '${BOOKING}/installation/t-1.jpg');
    raise notice 'R|${label}|stored';
  exception when others then
    raise notice 'R|${label}|%', sqlstate;
  end $$;`;

const result = (rows: string[][], label: string) => rows.find((row) => row[0] === label)![1];

describe.skipIf(!available)("booking photos (FO-F06-S01)", () => {
  it("should store a photo with its actor for an operations manager and let them read it back (AC05)", () => {
    const rows = run(`${SETUP} ${asCaller(USER("operations_manager"), `${record("add")} ${count("read")}`)}`);

    expect(result(rows, "add")).toBe("stored");
    expect(result(rows, "read")).toBe("1");
  });

  it("should keep the bucket private so no public link exists (FO-F06-S02 AC01)", () => {
    const rows = run(`
      do $$ begin
        raise notice 'R|public|%', (select public from storage.buckets where id = 'booking-photos');
      end $$;`);

    expect(result(rows, "public")).toBe("f");
  });

  it("should keep the path, record, actor, time and file type of a stored photo (FO-F06-S02 AC02, AC03)", () => {
    const rows = run(`
      ${SETUP}
      ${asCaller(
        USER("operations_manager"),
        `${record("add")}
         do $$ begin
           raise notice 'R|saved|%', (
             select concat_ws(',', storage_path = '${PATH}', booking_id = '${BOOKING}', type, content_type,
               uploaded_by is not null, created_at is not null)
             from public.booking_photos);
         end $$;`,
      )}`);

    expect(result(rows, "saved")).toBe("true,true,installation,image/jpeg,true,true");
  });

  it.each([["technician"], ["partner_user"]])("should refuse a %s who has no link to the booking the photo and the read (FO-F06-S03 AC02)", (role) => {
    const rows = run(`
      ${SETUP}
      ${asCaller(USER("operations_manager"), record("seed"))}
      ${asCaller(USER(role), `${record("add")} ${count("read")} ${files("file")}`)}`);

    expect(result(rows, "add")).toBe("42501");
    expect(result(rows, "read")).toBe("0");
    expect(result(rows, "file")).toBe("0");
  });

  it("should let the assigned technician add and read a photo of their booking (FO-F06-S03 AC01)", () => {
    const rows = run(`
      ${SETUP}
      update public.bookings set assigned_technician_id = ${USER("technician")} where id = '${BOOKING}';
      ${asCaller(USER("technician"), `${addFile("upload")} ${record("add")} ${count("read")} ${files("file")}`)}`);

    expect(result(rows, "upload")).toBe("stored");
    expect(result(rows, "add")).toBe("stored");
    expect(result(rows, "read")).toBe("1");
    expect(result(rows, "file")).toBe("2");
  });

  it("should refuse a technician who is not assigned the upload and the photo (FO-F06-S03 AC03)", () => {
    const rows = run(`
      ${SETUP}
      update public.bookings set assigned_technician_id = ${USER("technician", 1)} where id = '${BOOKING}';
      ${asCaller(USER("technician"), `${addFile("upload")} ${record("add")}`)}`);

    expect(result(rows, "upload")).not.toBe("stored");
    expect(result(rows, "add")).toBe("42501");
  });

  it("should let a partner user read the photos of their own partner and none of another partner (FO-F06-S03 AC01, AC02)", () => {
    const rows = run(`
      ${SETUP}
      update public.bookings set partner_id = (select partner_id from public.users where id::text = ${USER("partner_user")})
        where id = '${BOOKING}';
      ${asCaller(USER("operations_manager"), record("seed"))}
      ${asCaller(USER("partner_user"), `${count("own")} ${files("ownfile")}`)}
      update public.bookings set partner_id = (
        select p.id from public.partners p
        where p.id <> (select partner_id from public.users where id::text = ${USER("partner_user")}) limit 1
      ) where id = '${BOOKING}';
      ${asCaller(USER("partner_user"), `${count("other")} ${files("otherfile")}`)}`);

    expect(result(rows, "own")).toBe("1");
    expect(result(rows, "ownfile")).toBe("1");
    expect(result(rows, "other")).toBe("0");
    expect(result(rows, "otherfile")).toBe("0");
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
