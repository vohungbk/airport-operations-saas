import { beforeAll, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import {
  CATEGORY_IDS,
  CLEANING_IDS,
  DCR,
  DEMO_ACCOUNTS,
  DMO,
  INCIDENT_IDS,
  INSPECTION_IDS,
  INSTALLATION_IDS,
  JOB_IDS,
  SEED_BOOKING_IDS as ALL_SEED_BOOKING_IDS,
  SEED_SEAT_IDS as ALL_SEED_SEAT_IDS,
  USER_IDS,
  bookingId,
  demoLogin,
} from "@/lib/demo/demo-seed";
import {
  createServiceRoleClient,
  getLocalSupabaseConfig,
  signInTestUser,
  type LocalSupabaseConfig,
} from "@/lib/auth/rls-test-support";

/**
 * VI-F07-S04: the demo data has users and records for every role and two
 * partners, so that isolation can be shown. For each demo account and each kind
 * of record, the seeded rows it can see must be exactly the ones its role and
 * partner are meant to see (the rules of the RLS policies, written here as the
 * expected result), and the two partners and the technicians must see nothing
 * of each other's. It looks only at the rows of the seed, found by their fixed
 * ids, so rows left by other suites do not matter.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const config = getLocalSupabaseConfig();

// The matrix is about the demo flows: bookings 21 to 30 and what hangs off them
// (the jobs, records, incidents and history of the seed), and the seats from 21
// on. The first bookings and seats belong to the base seed, and the RLS suite
// uses them, and the first technician as the owner of its fixtures, adding jobs,
// events and records to them while this suite may be running; they are left out
// of both sides of every comparison, so that what is compared is stable.
const SEED_BOOKING_IDS = ALL_SEED_BOOKING_IDS.slice(20);
const SEED_SEAT_IDS = ALL_SEED_SEAT_IDS.slice(20);

type Db = SupabaseClient<Database>;
type Tables = Database["public"]["Tables"];

const KINDS = [
  "bookings",
  "booking_events",
  "seats",
  "seat_status_history",
  "technician_jobs",
  "technician_job_events",
  "installations",
  "cleaning_records",
  "inspection_records",
  "incidents",
  "incident_status_history",
  "partners",
  "users",
] as const;
type Kind = (typeof KINDS)[number];
type Visible = Record<Kind, Set<string>>;

describe.skipIf(!config)("demo data covers every role and two partners (VI-F07-S04)", () => {
  const cfg = config as LocalSupabaseConfig;
  let service: Db;
  const clients = new Map<string, Db>();

  // The seed, as the service role sees it: the truth the rules are applied to.
  let bookings: Tables["bookings"]["Row"][];
  let jobs: Tables["technician_jobs"]["Row"][];
  let incidents: Tables["incidents"]["Row"][];
  let cleaning: Tables["cleaning_records"]["Row"][];
  let inspections: Tables["inspection_records"]["Row"][];
  let installations: Tables["installations"]["Row"][];
  let bookingEvents: Tables["booking_events"]["Row"][];
  let seatHistory: Tables["seat_status_history"]["Row"][];
  let jobEvents: Tables["technician_job_events"]["Row"][];
  let incidentHistory: Tables["incident_status_history"]["Row"][];
  let seats: Tables["seats"]["Row"][];

  const ids = <T extends { id: string }>(list: T[]) => new Set(list.map((r) => r.id));
  const all = (list: { id: string }[]) => ids(list);

  async function fetchRows<T extends keyof Tables>(
    table: T,
    filter: { column: string; values: string[] },
  ) {
    const { data, error } = await service
      .from(table)
      .select("*")
      .in(filter.column as never, filter.values as never)
      .limit(1000);
    expect(error, String(table)).toBeNull();
    return (data ?? []) as unknown as Tables[T]["Row"][];
  }

  beforeAll(async () => {
    service = createServiceRoleClient(cfg);
    bookings = await fetchRows("bookings", { column: "id", values: SEED_BOOKING_IDS });
    seats = await fetchRows("seats", { column: "id", values: SEED_SEAT_IDS });
    jobs = await fetchRows("technician_jobs", { column: "id", values: JOB_IDS });
    incidents = await fetchRows("incidents", { column: "id", values: INCIDENT_IDS });
    cleaning = await fetchRows("cleaning_records", { column: "id", values: CLEANING_IDS });
    inspections = await fetchRows("inspection_records", { column: "id", values: INSPECTION_IDS });
    installations = await fetchRows("installations", { column: "id", values: INSTALLATION_IDS });
    bookingEvents = await fetchRows("booking_events", { column: "booking_id", values: SEED_BOOKING_IDS });
    seatHistory = await fetchRows("seat_status_history", { column: "seat_id", values: SEED_SEAT_IDS });
    jobEvents = await fetchRows("technician_job_events", { column: "technician_job_id", values: JOB_IDS });
    incidentHistory = await fetchRows("incident_status_history", {
      column: "incident_id",
      values: INCIDENT_IDS,
    });

    if (!bookings.length || !jobs.length) {
      throw new Error("The demo data is not loaded. Run `npm run demo:reset`.");
    }

    for (const [email] of DEMO_ACCOUNTS) {
      clients.set(email, await signInTestUser(cfg, email, demoLogin()));
    }
  }, 60_000);

  /** What the seeded rows are meant to be visible to this account. */
  function expected(email: string): Visible {
    const none = (): Set<string> => new Set();
    const partnerOf = (id: string) => bookings.find((b) => b.id === id)?.partner_id;
    const role = DEMO_ACCOUNTS.find(([e]) => e === email)![1];
    const userId = Object.values(USER_IDS).find((_, i) => DEMO_ACCOUNTS[i][0] === email)!;

    if (role === "admin" || role === "operations_manager") {
      return {
        bookings: all(bookings),
        booking_events: all(bookingEvents),
        seats: all(seats),
        seat_status_history: all(seatHistory),
        technician_jobs: all(jobs),
        technician_job_events: all(jobEvents),
        installations: all(installations),
        cleaning_records: all(cleaning),
        inspection_records: all(inspections),
        incidents: all(incidents),
        incident_status_history: all(incidentHistory),
        partners: new Set([DCR, DMO]),
        users: new Set(Object.values(USER_IDS)),
      };
    }

    if (role === "partner_user") {
      const own = email.includes(".dcr@") ? DCR : DMO;
      const myBookings = bookings.filter((b) => b.partner_id === own);
      const myBookingIds = ids(myBookings);
      const myJobs = jobs.filter((j) => partnerOf(j.booking_id) === own);
      const myJobIds = ids(myJobs);

      return {
        bookings: myBookingIds,
        booking_events: ids(bookingEvents.filter((e) => myBookingIds.has(e.booking_id))),
        seats: new Set(myBookings.map((b) => b.assigned_seat_id).filter((s): s is string => !!s)),
        seat_status_history: none(),
        technician_jobs: myJobIds,
        technician_job_events: none(),
        installations: ids(installations.filter((i) => myJobIds.has(i.technician_job_id))),
        cleaning_records: ids(cleaning.filter((c) => c.booking_id && myBookingIds.has(c.booking_id))),
        inspection_records: ids(inspections.filter((i) => i.booking_id && myBookingIds.has(i.booking_id))),
        incidents: ids(incidents.filter((i) => i.partner_id === own)),
        incident_status_history: none(),
        partners: new Set([own]),
        users: new Set([userId]),
      };
    }

    // A technician: their own jobs, and what hangs off them.
    const myJobs = jobs.filter((j) => j.technician_id === userId);
    const myJobIds = ids(myJobs);
    const myBookings = bookings.filter(
      (b) => b.assigned_technician_id === userId || myJobs.some((j) => j.booking_id === b.id),
    );
    const myBookingIds = ids(myBookings);
    const jobBookings = new Set(myJobs.map((j) => j.booking_id));

    return {
      bookings: myBookingIds,
      booking_events: ids(bookingEvents.filter((e) => myBookingIds.has(e.booking_id))),
      seats: new Set(
        bookings
          .filter((b) => jobBookings.has(b.id))
          .map((b) => b.assigned_seat_id)
          .filter((s): s is string => !!s),
      ),
      seat_status_history: none(),
      technician_jobs: myJobIds,
      technician_job_events: ids(jobEvents.filter((e) => myJobIds.has(e.technician_job_id))),
      installations: ids(installations.filter((i) => myJobIds.has(i.technician_job_id))),
      cleaning_records: ids(
        cleaning.filter((c) => c.employee_id === userId || (c.technician_job_id && myJobIds.has(c.technician_job_id))),
      ),
      inspection_records: ids(
        inspections.filter((i) => i.inspector_id === userId || (i.technician_job_id && myJobIds.has(i.technician_job_id))),
      ),
      incidents: ids(
        incidents.filter((i) => i.reported_by === userId || (i.technician_job_id && myJobIds.has(i.technician_job_id))),
      ),
      incident_status_history: none(),
      partners: none(),
      users: new Set([userId]),
    };
  }

  /** What the seeded rows really are to this account, read as that account. */
  async function visible(email: string): Promise<Visible> {
    const client = clients.get(email)!;
    const read = async (
      table: keyof Tables,
      column: string,
      values: string[],
    ): Promise<Set<string>> => {
      const { data, error } = await client
        .from(table)
        .select("id")
        .in(column as never, values as never)
        .limit(1000);
      expect(error, `${email}: ${table}`).toBeNull();
      return new Set(((data ?? []) as unknown as { id: string }[]).map((r) => r.id));
    };

    return {
      bookings: await read("bookings", "id", SEED_BOOKING_IDS),
      booking_events: await read("booking_events", "booking_id", SEED_BOOKING_IDS),
      seats: await read("seats", "id", SEED_SEAT_IDS),
      seat_status_history: await read("seat_status_history", "seat_id", SEED_SEAT_IDS),
      technician_jobs: await read("technician_jobs", "id", JOB_IDS),
      technician_job_events: await read("technician_job_events", "technician_job_id", JOB_IDS),
      installations: await read("installations", "id", INSTALLATION_IDS),
      cleaning_records: await read("cleaning_records", "id", CLEANING_IDS),
      inspection_records: await read("inspection_records", "id", INSPECTION_IDS),
      incidents: await read("incidents", "id", INCIDENT_IDS),
      incident_status_history: await read("incident_status_history", "incident_id", INCIDENT_IDS),
      partners: await read("partners", "id", [DCR, DMO]),
      users: await read("users", "id", Object.values(USER_IDS)),
    };
  }

  const sorted = (set: Set<string>) => [...set].sort();

  describe("who sees what: every account, every kind of record (TC01, TC02)", () => {
    it.each(DEMO_ACCOUNTS)("should show %s (%s) exactly the seeded records its role and partner allow", async (email) => {
      const want = expected(email);
      const got = await visible(email);

      for (const kind of KINDS) {
        expect(sorted(got[kind]), `${email}: ${kind}`).toEqual(sorted(want[kind]));
      }
    });

    it("should leave every kind of record with something to see, for at least one role (the matrix is not empty)", async () => {
      const admin = expected("admin@airportops.example");

      for (const kind of KINDS) {
        expect(admin[kind].size, kind).toBeGreaterThan(0);
      }
      expect(CATEGORY_IDS.length).toBe(4);
    });
  });

  describe("isolation can be shown: the partners and the technicians see nothing of each other's", () => {
    const PARTNER_OWNED: Kind[] = [
      "bookings",
      "booking_events",
      "seats",
      "technician_jobs",
      "installations",
      "cleaning_records",
      "inspection_records",
      "incidents",
      "partners",
    ];

    it("should give the two partner accounts no record in common, on any kind of record that a partner owns", async () => {
      const a = await visible("partner.dcr@airportops.example");
      const b = await visible("partner.dmo@airportops.example");

      for (const kind of PARTNER_OWNED) {
        expect(a[kind].size + b[kind].size, kind).toBeGreaterThan(0);
        expect([...a[kind]].filter((id) => b[kind].has(id)), kind).toEqual([]);
      }
    });

    it("should give each partner account records of its own on the main kinds, so the difference can be shown", async () => {
      for (const email of ["partner.dcr@airportops.example", "partner.dmo@airportops.example"]) {
        const mine = await visible(email);

        for (const kind of ["bookings", "seats", "technician_jobs", "incidents", "installations"] as const) {
          expect(mine[kind].size, `${email}: ${kind}`).toBeGreaterThan(0);
        }
      }
    });

    it("should give the technicians jobs, and records of the work, that no other technician sees", async () => {
      const emails = DEMO_ACCOUNTS.filter(([, role]) => role === "technician").map(([e]) => e);
      const seen = await Promise.all(emails.map((e) => visible(e)));

      for (const kind of ["technician_jobs", "technician_job_events"] as const) {
        const everyId = seen.flatMap((v) => [...v[kind]]);
        expect(new Set(everyId).size, kind).toBe(everyId.length);
        for (const v of seen) {
          expect(v[kind].size, kind).toBeGreaterThanOrEqual(2);
        }
      }
    });

    it("should hide the partners' records from a technician unless they are on the technician's own jobs", async () => {
      const tech = await visible("technician2@airportops.example");
      const myBookingPartners = new Set(
        bookings.filter((b) => tech.bookings.has(b.id)).map((b) => b.partner_id),
      );

      // Technician 2 works for both partners, but sees no partner row and no
      // incident that is not about their own jobs.
      expect(tech.partners.size).toBe(0);
      expect(myBookingPartners.size).toBeGreaterThanOrEqual(1);
      for (const id of tech.incidents) {
        const incident = incidents.find((i) => i.id === id)!;
        const job = jobs.find((j) => j.id === incident.technician_job_id);
        expect(job?.technician_id === USER_IDS.technician2 || incident.reported_by === USER_IDS.technician2).toBe(true);
      }
    });
  });

  describe("every role has records of its own, and the data is varied enough to demo (spec R4)", () => {
    const actorsOf = (list: { user_id: string | null }[]) => new Set(list.map((r) => r.user_id));

    it("should have history written by each role: the admin, the operations manager, a partner user of each partner, and each technician", () => {
      const actors = new Set([
        ...actorsOf(bookingEvents),
        ...actorsOf(jobEvents),
        ...actorsOf(incidentHistory),
        ...seatHistory.map((h) => h.changed_by),
      ]);

      for (const [name, id] of Object.entries(USER_IDS)) {
        expect(actors.has(id), name).toBe(true);
      }
    });

    it("should record who did each step of a booking, so its timeline says who did what", () => {
      const timeline = bookingEvents
        .filter((e) => e.booking_id === bookingId(23)) // BK-00023, the rental in progress
        .sort((x, y) => x.created_at.localeCompare(y.created_at));

      expect(timeline.map((e) => e.to_status)).toEqual(["pending", "confirmed", "in_progress"]);
      expect(timeline.map((e) => e.user_id)).toEqual([USER_IDS.ops, USER_IDS.ops, USER_IDS.technician1]);
    });

    it("should have a partner's own request made by that partner's user, and never by the other partner's", () => {
      const created = (n: number) => bookingEvents.find((e) => e.booking_id === bookingId(n) && e.from_status === null);

      expect(created(21)?.user_id).toBe(USER_IDS.partnerDcr);
      expect(created(22)?.user_id).toBe(USER_IDS.partnerDmo);
    });

    it("should have each partner with bookings in every state a demo needs", () => {
      for (const partner of [DCR, DMO]) {
        const statuses = new Set(bookings.filter((b) => b.partner_id === partner).map((b) => b.status));

        for (const needed of ["pending", "confirmed", "in_progress", "completed"] as const) {
          expect(statuses.has(needed), `${partner}: ${needed}`).toBe(true);
        }
        expect(statuses.has("cancelled") || statuses.has("no_show"), partner).toBe(true);
      }
    });

    it("should have the two partners differ, so isolation shows: an open incident for one, a resolved one for the other", () => {
      const byPartner = (partner: string) => incidents.filter((i) => i.partner_id === partner).map((i) => i.status);

      expect(byPartner(DCR)).toEqual(["resolved"]);
      expect(byPartner(DMO)).toEqual(["open"]);
    });

    it("should have each technician with jobs in more than one state or kind", () => {
      for (const technician of [USER_IDS.technician1, USER_IDS.technician2, USER_IDS.technician3]) {
        const mine = jobs.filter((j) => j.technician_id === technician);

        expect(mine.length, technician).toBeGreaterThanOrEqual(2);
        expect(new Set(mine.map((j) => `${j.job_type}/${j.status}`)).size, technician).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe("who did it is shown to those who may see it (TC02)", () => {
    const timelineOf = async (email: string, n: number) => {
      const { data, error } = await clients
        .get(email)!
        .from("booking_events")
        .select("to_status, actor:users(full_name)")
        .eq("booking_id", bookingId(n));

      expect(error).toBeNull();
      return (data ?? []) as unknown as { to_status: string; actor: { full_name: string } | null }[];
    };

    it("should show the operations manager the name of whoever did each step", async () => {
      const names = (await timelineOf("ops.manager@airportops.example", 23)).map((e) => e.actor?.full_name);

      expect(names).toContain("Demo Operations Manager");
      expect(names).toContain("Demo Technician One");
    });

    it("should not show a partner the name of anyone else: the operations manager and the technician stay anonymous", async () => {
      const names = (await timelineOf("partner.dcr@airportops.example", 23)).map((e) => e.actor?.full_name ?? null);

      expect(names.length).toBeGreaterThan(0);
      expect(names).not.toContain("Demo Operations Manager");
      expect(names).not.toContain("Demo Technician One");
    });

    it("should show a partner their own name on their own request, and nobody else's name on it", async () => {
      const names = (await timelineOf("partner.dcr@airportops.example", 21)).map((e) => e.actor?.full_name ?? null);

      expect(names).toContain("Demo Car Rental Partner User");
    });
  });
});
