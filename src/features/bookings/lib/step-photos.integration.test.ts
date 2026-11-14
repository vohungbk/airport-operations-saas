import { describe, expect, it } from "vitest";

import { AIRPORT, CATEGORY, PARTNER, USER, available, run } from "@/lib/finance/finance-test-support";

/**
 * FO-F06-S06: an installation and an incident cannot be saved by a signed-in user unless the booking of the
 * job has a photo of the needed type. A photo of another booking, or of another type, does not count. Every
 * scenario runs in a transaction that is rolled back and makes its own booking, seat and job. Skipped when
 * the local stack is not running.
 */
const BOOKING = "de000000-0000-0000-0000-000000000001";
const OTHER_BOOKING = "de000000-0000-0000-0000-000000000002";
const SEAT = "de700000-0000-0000-0000-000000000001";
const JOB = "de100000-0000-0000-0000-000000000001";
const TECH = USER("technician");

const SETUP = `
  insert into public.seats (id, serial_number, manufacturer, model, category_id, airport_id, manufacture_date, purchase_date, max_rental_cycles)
  values ('${SEAT}', 'SP-SEAT-1', 'Test', 'Test', '${CATEGORY}', '${AIRPORT}', date '2029-01-01', date '2029-01-01', 100);
  insert into public.bookings (id, booking_number, partner_id, airport_id, pickup_at, return_at, seat_category_id, daily_rate, assigned_seat_id)
  values ('${BOOKING}', 'SP-01', '${PARTNER}', '${AIRPORT}', '2033-01-05 10:00:00+00', '2033-01-10 10:00:00+00', '${CATEGORY}', 90, '${SEAT}'),
         ('${OTHER_BOOKING}', 'SP-02', '${PARTNER}', '${AIRPORT}', '2033-01-05 10:00:00+00', '2033-01-10 10:00:00+00', '${CATEGORY}', 90, null);
  insert into public.technician_jobs (id, booking_id, technician_id, job_type, status)
  values ('${JOB}', '${BOOKING}', ${TECH}::uuid, 'installation', 'assigned');`;

const photo = (bookingId: string, type: string) => `
  insert into public.booking_photos (booking_id, type, storage_path, uploaded_by)
  values ('${bookingId}', '${type}', '${bookingId}/${type}/p.jpg', ${TECH}::uuid);`;

/** The next statements are made by the technician through the API (JWT role authenticated). */
const asTechnician = (body: string) => `
  set local role authenticated;
  select set_config('request.jwt.claim.sub', ${TECH}, true);
  select set_config('request.jwt.claim.role', 'authenticated', true);
  ${body}
  reset role;`;

const saveInstallation = (label: string) => `
  do $$ begin
    insert into public.installations (technician_job_id) values ('${JOB}');
    raise notice 'R|${label}|saved';
  exception when others then
    raise notice 'R|${label}|%', sqlstate;
  end $$;`;

const saveIncident = (label: string) => `
  do $$ begin
    insert into public.incidents (partner_id, technician_job_id, type, severity, description, reported_by)
    values ('${PARTNER}', '${JOB}', 'installation', 'low', 'Scratch on the shell', ${TECH}::uuid);
    raise notice 'R|${label}|saved';
  exception when others then
    raise notice 'R|${label}|%', sqlstate;
  end $$;`;

const result = (rows: string[][], label: string) => rows.find((row) => row[0] === label)![1];

describe.skipIf(!available)("photos required on steps (FO-F06-S06)", () => {
  it("should refuse an installation without a photo and accept it once the booking has one (AC01)", () => {
    const rows = run(`${SETUP}
      ${asTechnician(saveInstallation("without"))}
      ${photo(BOOKING, "installation")}
      ${asTechnician(saveInstallation("with"))}`);

    expect(result(rows, "without")).toBe("JB010");
    expect(result(rows, "with")).toBe("saved");
  });

  it("should not count a photo of another booking for an installation", () => {
    const rows = run(`${SETUP} ${photo(OTHER_BOOKING, "installation")} ${asTechnician(saveInstallation("other"))}`);

    expect(result(rows, "other")).toBe("JB010");
  });

  it("should refuse an incident without a photo of type incident and accept it once there is one (AC01)", () => {
    const rows = run(`${SETUP}
      ${photo(BOOKING, "installation")}
      ${asTechnician(saveIncident("without"))}
      ${photo(BOOKING, "incident")}
      ${asTechnician(saveIncident("with"))}`);

    expect(result(rows, "without")).toBe("JB010");
    expect(result(rows, "with")).toBe("saved");
  });

  it("should not count a photo of another booking for an incident", () => {
    const rows = run(`${SETUP} ${photo(OTHER_BOOKING, "incident")} ${asTechnician(saveIncident("other"))}`);

    expect(result(rows, "other")).toBe("JB010");
  });
});
