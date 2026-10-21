import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeAll, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import { findSensitiveData } from "@/lib/demo/sensitive-data";
import { getDashboardMetrics } from "@/features/dashboard/lib/get-dashboard-metrics";
import {
  createServiceRoleClient,
  getLocalSupabaseConfig,
  signInTestUser,
  type LocalSupabaseConfig,
} from "@/lib/auth/rls-test-support";

/**
 * VI-F07-S01: the demo data (`supabase/seed.sql` and `supabase/seeds/demo.sql`)
 * is coherent, and each role can sign in and see its own journey.
 *
 * Runs against the local database after `npm run demo:reset` (or any
 * `supabase db reset`). It looks only at the rows of the seed, found by their
 * fixed ids and the demo addresses, so test rows left by other suites do not
 * matter. Skipped when the local stack is not running, like the RLS suite.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const config = getLocalSupabaseConfig();

/** The demo login is public and lives in one place: the seed that sets it. */
function demoLogin(): string {
  const seed = readFileSync(join(process.cwd(), "supabase", "seeds", "demo.sql"), "utf8");
  return /c_password constant text := '([^']+)'/.exec(seed)![1];
}

const DCR = "b0000000-0000-0000-0000-000000000001";
const DMO = "b0000000-0000-0000-0000-000000000002";

const DEMO_ACCOUNTS = [
  ["admin@airportops.example", "admin"],
  ["ops.manager@airportops.example", "operations_manager"],
  ["partner.dcr@airportops.example", "partner_user"],
  ["partner.dmo@airportops.example", "partner_user"],
  ["technician1@airportops.example", "technician"],
  ["technician2@airportops.example", "technician"],
  ["technician3@airportops.example", "technician"],
] as const;

const bookingId = (n: number) =>
  `f0000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const seatId = (n: number) =>
  `e0000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const SEED_BOOKING_IDS = Array.from({ length: 30 }, (_, i) => bookingId(i + 1));
const SEED_SEAT_IDS = Array.from({ length: 40 }, (_, i) => seatId(i + 1));
const ACTIVE = ["pending", "confirmed", "assigned", "in_progress"];

/** A fixed id: a prefix and a number, as the seed writes them. */
const idOf = (prefix: string, n: number) =>
  `${prefix}-0000-0000-0000-${String(n).padStart(12, "0")}`;
const JOB_IDS = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => idOf("10000000", n));
const INSTALLATION_IDS = [1, 3, 4].map((n) => idOf("11000000", n));
const CLEANING_IDS = [idOf("12000000", 5)];
const INSPECTION_IDS = [idOf("13000000", 6)];
const INCIDENT_IDS = [1, 2].map((n) => idOf("14000000", n));

/** The database container of the local stack, found from the project id. */
function dbContainer(): string | null {
  try {
    const toml = readFileSync(join(process.cwd(), "supabase", "config.toml"), "utf8");
    const id = /^project_id\s*=\s*"([^"]+)"/m.exec(toml)?.[1];
    return id ? `supabase_db_${id}` : null;
  } catch {
    return null;
  }
}

/** Runs SQL in the local database container; `null` when Docker is not there. */
function runSql(sql: string): { ok: boolean; output: string } | null {
  const container = dbContainer();
  if (!container) return null;

  const result = spawnSync(
    "docker",
    ["exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"],
    { input: sql, encoding: "utf8", timeout: 60_000 },
  );

  if (result.error) return null;

  return {
    ok: result.status === 0,
    output: `${result.stdout}${result.stderr}`,
  };
}

describe.skipIf(!config)("demo data (VI-F07-S01)", () => {
  const cfg = config as LocalSupabaseConfig;
  let service: SupabaseClient<Database>;

  /**
   * The rows of a table, asked for by id, or by a column that is in a list or
   * like a pattern. Never "everything": a busy database has more rows than one
   * request returns, and the rows of the seed must not be among those left out.
   */
  async function rows<T extends keyof Database["public"]["Tables"]>(
    table: T,
    ids?: string[],
    where?: { column: string; in?: string[]; like?: string },
  ) {
    let query = service.from(table).select("*");
    if (ids) query = query.in("id" as never, ids as never);
    if (where?.in) query = query.in(where.column as never, where.in as never);
    if (where?.like) query = query.like(where.column as never, where.like as never);
    const { data, error } = await query.limit(1000);
    expect(error, String(table)).toBeNull();
    return (data ?? []) as unknown as Database["public"]["Tables"][T]["Row"][];
  }

  const demoUsers = () => rows("users", undefined, { column: "email", like: "%@airportops.example" });
  const eventsOfBookings = (ids: string[]) =>
    rows("booking_events", undefined, { column: "booking_id", in: ids });

  beforeAll(async () => {
    service = createServiceRoleClient(cfg);
    const { data } = await service
      .from("users")
      .select("id")
      .eq("email", "admin@airportops.example");

    if (!data?.length) {
      throw new Error("The demo data is not loaded. Run `npm run demo:reset`.");
    }
  }, 30_000);

  describe("coherence (spec R1)", () => {
    it("should have the whole seed: 30 bookings, 40 seats, 2 partners, 4 categories", async () => {
      expect(await rows("bookings", SEED_BOOKING_IDS)).toHaveLength(30);
      expect(await rows("seats", SEED_SEAT_IDS)).toHaveLength(40);
      expect(
        (await rows("partners")).filter((p) => [DCR, DMO].includes(p.id)),
      ).toHaveLength(2);
      expect(await rows("seat_categories")).toHaveLength(4);
    });

    it("should give every seeded booking a seat of its own airport and category", async () => {
      const seats = new Map((await rows("seats", SEED_SEAT_IDS)).map((s) => [s.id, s]));
      const withSeat = (await rows("bookings", SEED_BOOKING_IDS)).filter((b) => b.assigned_seat_id);

      expect(withSeat.length).toBeGreaterThan(20);
      for (const booking of withSeat) {
        const seat = seats.get(booking.assigned_seat_id!);

        expect(seat, booking.booking_number).toBeDefined();
        expect(seat!.airport_id, booking.booking_number).toBe(booking.airport_id);
        expect(seat!.category_id, booking.booking_number).toBe(booking.seat_category_id);
      }
    });

    it("should never put two active bookings on one seat for overlapping periods", async () => {
      const active = (await rows("bookings", SEED_BOOKING_IDS)).filter(
        (b) => b.assigned_seat_id && ACTIVE.includes(b.status),
      );

      for (const a of active) {
        for (const b of active) {
          if (a.id < b.id && a.assigned_seat_id === b.assigned_seat_id) {
            const overlap =
              new Date(a.pickup_at) < new Date(b.return_at) &&
              new Date(b.pickup_at) < new Date(a.return_at);

            expect(overlap, `${a.booking_number} and ${b.booking_number}`).toBe(false);
          }
        }
      }
    });

    it("should have unique identifiers: booking numbers, seat serials and emails", async () => {
      const bookings = await rows("bookings", SEED_BOOKING_IDS);
      const seats = await rows("seats", SEED_SEAT_IDS);
      const users = await rows("users", undefined, { column: "email", like: "%.example" });

      for (const values of [
        bookings.map((b) => b.booking_number),
        seats.map((s) => s.serial_number),
        users.map((u) => u.email),
      ]) {
        expect(new Set(values).size).toBe(values.length);
      }
      expect(bookings.map((b) => b.booking_number).sort()).toEqual(
        Array.from({ length: 30 }, (_, i) => `BK-${String(i + 1).padStart(5, "0")}`),
      );
    });

    it("should have a valid period and honest figures on every booking", async () => {
      for (const booking of await rows("bookings", SEED_BOOKING_IDS)) {
        expect(new Date(booking.return_at) >= new Date(booking.pickup_at), booking.booking_number).toBe(true);
        expect(Number(booking.daily_rate), booking.booking_number).toBeGreaterThanOrEqual(0);
        if (booking.status === "completed") {
          expect(booking.paid_days, booking.booking_number).toBeGreaterThan(0);
        }
      }
    });

    it("should have a booking history that ends at the booking's status, with each step starting where the last ended", async () => {
      const byBooking = Map.groupBy(
        await eventsOfBookings(SEED_BOOKING_IDS),
        (e) => e.booking_id,
      );

      for (const booking of await rows("bookings", SEED_BOOKING_IDS)) {
        const chain = (byBooking.get(booking.id) ?? [])
          // The status steps only: other suites add events to two seeded bookings.
          .filter((e) =>
            ["created", "status_changed"].includes(
              (e.metadata as { event_type?: string } | null)?.event_type ?? "",
            ),
          )
          .sort((x, y) => x.created_at.localeCompare(y.created_at));

        expect(chain.length, booking.booking_number).toBeGreaterThan(0);
        expect(chain[0].from_status, booking.booking_number).toBeNull();
        chain.slice(1).forEach((event, i) => {
          expect(event.from_status, booking.booking_number).toBe(chain[i].to_status);
        });
        expect(chain.at(-1)!.to_status, booking.booking_number).toBe(booking.status);
      }
    });

    it("should have a seat history that ends at the seat's status", async () => {
      const bySeat = Map.groupBy(
        await rows("seat_status_history", undefined, { column: "seat_id", in: SEED_SEAT_IDS }),
        (h) => h.seat_id,
      );

      for (const seat of await rows("seats", SEED_SEAT_IDS)) {
        const chain = (bySeat.get(seat.id) ?? []).sort((x, y) =>
          x.created_at.localeCompare(y.created_at),
        );

        expect(chain.length, seat.serial_number).toBeGreaterThan(0);
        expect(chain.at(-1)!.to_status, seat.serial_number).toBe(seat.status);
      }
    });

    it("should tie every job to an active technician and an existing booking, with a history that ends at its status", async () => {
      const users = new Map((await demoUsers()).map((u) => [u.id, u]));
      const jobs = await rows("technician_jobs", JOB_IDS);
      const events = await rows("technician_job_events", undefined, {
        column: "technician_job_id",
        in: JOB_IDS,
      });

      expect(jobs).toHaveLength(8);
      for (const job of jobs) {
        const technician = users.get(job.technician_id);
        expect(technician?.role, job.id).toBe("technician");
        expect(technician?.is_active, job.id).toBe(true);
        expect(SEED_BOOKING_IDS, job.id).toContain(job.booking_id);

        const chain = events
          .filter((e) => e.technician_job_id === job.id)
          .sort((x, y) => x.created_at.localeCompare(y.created_at));
        if (job.status === "assigned") {
          expect(chain, job.id).toHaveLength(0);
        } else {
          expect(chain[0].from_status, job.id).toBe("assigned");
          expect(chain.at(-1)!.to_status, job.id).toBe(job.status);
          expect(job.started_at, job.id).not.toBeNull();
        }
        if (job.status === "completed") {
          expect(job.completed_at, job.id).not.toBeNull();
        }
      }
    });

    it("should tie every record of work to a job of the same type and to the seat of its booking", async () => {
      const jobs = new Map((await rows("technician_jobs", JOB_IDS)).map((j) => [j.id, j]));
      const bookings = new Map((await rows("bookings", SEED_BOOKING_IDS)).map((b) => [b.id, b]));
      const check = (kind: string, id: string, jobId: string | null, seat: string | null) => {
        const job = jobs.get(jobId ?? "");
        expect(job?.job_type, `${kind} ${id}`).toBe(kind);
        expect(seat, `${kind} ${id}`).toBe(bookings.get(job!.booking_id)?.assigned_seat_id);
      };

      const installations = await rows("installations", INSTALLATION_IDS);
      const cleanings = await rows("cleaning_records", CLEANING_IDS);
      const inspections = await rows("inspection_records", INSPECTION_IDS);

      expect(installations).toHaveLength(3);
      expect(cleanings).toHaveLength(1);
      expect(inspections).toHaveLength(1);
      installations.forEach((r) => check("installation", r.id, r.technician_job_id, r.seat_id));
      cleanings.forEach((r) => check("cleaning", r.id, r.technician_job_id, r.seat_id));
      inspections.forEach((r) => check("inspection", r.id, r.technician_job_id, r.seat_id));
    });

    it("should quarantine the seat of the failed inspection, with the reason in its history, and keep the other seats consistent", async () => {
      const seat = (await rows("seats", [seatId(26)]))[0];
      const history = await rows("seat_status_history", undefined, { column: "seat_id", in: [seat.id] });

      expect(seat.status).toBe("quarantine");
      expect(seat.quarantine_reason).toBeTruthy();
      expect(history.some((h) => h.to_status === "quarantine")).toBe(true);
    });

    it("should have incidents whose partner, booking and seat are those of their job, with a history that ends at their status", async () => {
      const jobs = new Map((await rows("technician_jobs", JOB_IDS)).map((j) => [j.id, j]));
      const bookings = new Map((await rows("bookings", SEED_BOOKING_IDS)).map((b) => [b.id, b]));
      const history = await rows("incident_status_history", undefined, {
        column: "incident_id",
        in: INCIDENT_IDS,
      });
      const incidents = await rows("incidents", INCIDENT_IDS);

      expect(incidents).toHaveLength(2);
      for (const incident of incidents) {
        const job = jobs.get(incident.technician_job_id ?? "")!;
        const booking = bookings.get(job.booking_id)!;

        expect(incident.booking_id).toBe(booking.id);
        expect(incident.partner_id).toBe(booking.partner_id);
        expect(incident.seat_id).toBe(booking.assigned_seat_id);

        const chain = history
          .filter((h) => h.incident_id === incident.id)
          .sort((x, y) => x.created_at.localeCompare(y.created_at));
        if (incident.status === "open") {
          expect(chain).toHaveLength(0);
        } else {
          expect(chain.at(-1)!.to_status).toBe(incident.status);
          expect(incident.resolved_by).not.toBeNull();
          expect(incident.resolved_at).not.toBeNull();
        }
      }
    });

    it("should have users whose role and partner agree: a partner user has a partner, the other roles have none", async () => {
      const demo = await demoUsers();

      expect(demo).toHaveLength(7);
      for (const user of demo) {
        expect(user.is_active, user.email).toBe(true);
        expect(user.partner_id !== null, user.email).toBe(user.role === "partner_user");
      }
    });
  });

  describe("no real data (spec R3, VI-F07-S03)", () => {
    // Every table the seed puts rows in. A table that is not here and not in
    // NOT_SEEDED fails the check below, so a new table forces a decision.
    const NOT_SEEDED = ["flights", "settlements", "invoices", "partner_commercial_terms", "ai_queries"];

    /** The rows of the seed, every column of them, by table. */
    async function seededRows() {
      const auth = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });

      return {
        users: await demoUsers(),
        partners: await rows("partners", [DCR, DMO]),
        airports: await rows("airports", ["a0000000-0000-0000-0000-000000000001"]),
        seat_categories: await rows("seat_categories", [1, 2, 3, 4].map((n) => idOf("c0000000", n))),
        seats: await rows("seats", SEED_SEAT_IDS),
        bookings: await rows("bookings", SEED_BOOKING_IDS),
        technician_jobs: await rows("technician_jobs", JOB_IDS),
        installations: await rows("installations", INSTALLATION_IDS),
        cleaning_records: await rows("cleaning_records", CLEANING_IDS),
        inspection_records: await rows("inspection_records", INSPECTION_IDS),
        incidents: await rows("incidents", INCIDENT_IDS),
        booking_events: await eventsOfBookings(SEED_BOOKING_IDS),
        seat_status_history: await rows("seat_status_history", undefined, { column: "seat_id", in: SEED_SEAT_IDS }),
        technician_job_events: await rows("technician_job_events", undefined, {
          column: "technician_job_id",
          in: JOB_IDS,
        }),
        incident_status_history: await rows("incident_status_history", undefined, {
          column: "incident_id",
          in: INCIDENT_IDS,
        }),
        auth_users: auth.data.users.filter((u) => u.email?.endsWith("@airportops.example")),
      };
    }

    it("should have no real personal, financial or credential data in any column of any seeded row", async () => {
      const tables = await seededRows();
      const findings: string[] = [];

      for (const [table, list] of Object.entries(tables)) {
        expect(list.length, table).toBeGreaterThan(0);
        for (const row of list as unknown as Record<string, unknown>[]) {
          for (const found of findSensitiveData(JSON.stringify(row))) {
            findings.push(`${table} ${String(row.id)}: ${found.kind} (${found.match})`);
          }
        }
      }

      expect(findings).toEqual([]);
    });

    it("should name every person and company of the seed as a demo one", async () => {
      const tables = await seededRows();

      for (const user of [...tables.users]) {
        expect(user.full_name.startsWith("Demo "), user.email).toBe(true);
      }
      for (const partner of tables.partners) {
        expect(partner.name.startsWith("Demo "), partner.name).toBe(true);
        expect(partner.contact_email.endsWith(".example")).toBe(true);
      }
    });

    it("should use only demo addresses for the accounts of the seed", async () => {
      const { users, auth_users } = await seededRows();

      expect(users.every((u) => /^[a-z0-9.]+@airportops\.example$/.test(u.email))).toBe(true);
      expect(auth_users.every((u) => /^[a-z0-9.]+@airportops\.example$/.test(u.email ?? ""))).toBe(true);
    });

    it("should know every table of the schema: seeded and scanned, or on the list of tables the seed leaves empty", () => {
      const result = runSql(
        "select string_agg(table_name, ',' order by table_name) from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE';",
      );
      if (!result) return; // No Docker: nothing to ask the database with.

      expect(result.ok, result.output).toBe(true);
      const tables = (/[a-z_,]+/.exec(result.output.split("\n").find((l) => l.includes("users")) ?? "")?.[0] ?? "").split(",");
      const known = new Set([
        ...Object.keys({
          users: 0, partners: 0, airports: 0, seat_categories: 0, seats: 0, bookings: 0,
          technician_jobs: 0, installations: 0, cleaning_records: 0, inspection_records: 0,
          incidents: 0, booking_events: 0, seat_status_history: 0, technician_job_events: 0,
          incident_status_history: 0,
        }),
        ...NOT_SEEDED,
      ]);

      expect(tables.length).toBeGreaterThan(10);
      expect(tables.filter((t) => !known.has(t))).toEqual([]);
    });

    it("should not put a credential in any column a user can read: no password, secret or hash column in the public tables", () => {
      const result = runSql(
        "select string_agg(table_name || '.' || column_name, ',') from information_schema.columns where table_schema = 'public' and column_name ~* '(password|passwd|secret|hash|credential|api_key)';",
      );
      if (!result) return;

      expect(result.ok, result.output).toBe(true);
      expect(result.output).not.toMatch(/\w+\.\w+/);
    });
  });

  describe("the demo accounts cannot reach credentials or another partner's details (VI-F07-S03, TC02)", () => {
    it.each(DEMO_ACCOUNTS)("should not let %s read the auth schema, where the password hashes are", async (email) => {
      const client = await signInTestUser(cfg, email, demoLogin());
      const result = await client.schema("auth" as never).from("users" as never).select("*");

      expect(result.data).toBeNull();
      expect(result.error).not.toBeNull();
    });

    it("should give each partner account only the contact details of its own partner", async () => {
      for (const [email, own] of [
        ["partner.dcr@airportops.example", DCR],
        ["partner.dmo@airportops.example", DMO],
      ] as const) {
        const client = await signInTestUser(cfg, email, demoLogin());
        const { data, error } = await client.from("partners").select("id, contact_email");

        expect(error).toBeNull();
        expect(data!.map((p) => p.id)).toEqual([own]);
        expect(data![0].contact_email.endsWith(".example")).toBe(true);
      }
    });

    it("should give a technician no partner contact details at all", async () => {
      const client = await signInTestUser(cfg, "technician1@airportops.example", demoLogin());
      const { data, error } = await client.from("partners").select("id, contact_email");

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it("should show the contact details of both partners only to admin and the operations manager", async () => {
      for (const email of ["admin@airportops.example", "ops.manager@airportops.example"]) {
        const client = await signInTestUser(cfg, email, demoLogin());
        const { data } = await client.from("partners").select("id").in("id", [DCR, DMO]);

        expect(data!.map((p) => p.id).sort(), email).toEqual([DCR, DMO].sort());
      }
    });
  });

  describe("every role can sign in and sees its own journey (AC02, spec R4)", () => {
    it.each(DEMO_ACCOUNTS)("should sign in as %s with the role %s", async (email, role) => {
      const client = await signInTestUser(cfg, email, demoLogin());
      const { data, error } = await client.from("users").select("role").eq("email", email);

      expect(error).toBeNull();
      expect(data).toEqual([{ role }]);
    });

    it("should refuse the wrong password", async () => {
      await expect(
        signInTestUser(cfg, "admin@airportops.example", "not-the-password"),
      ).rejects.toThrow();
    });

    it("should give admin and the operations manager the whole platform", async () => {
      for (const email of ["admin@airportops.example", "ops.manager@airportops.example"]) {
        const client = await signInTestUser(cfg, email, demoLogin());
        const bookings = await client.from("bookings").select("id", { count: "exact", head: true });
        const seats = await client.from("seats").select("id", { count: "exact", head: true });

        expect(bookings.count, email).toBeGreaterThanOrEqual(30);
        expect(seats.count, email).toBeGreaterThanOrEqual(40);
      }
    });

    it.each([
      ["partner.dcr@airportops.example", DCR, DMO],
      ["partner.dmo@airportops.example", DMO, DCR],
    ])("should give %s only the bookings of their own partner, and no seat or booking of the other", async (email, own, other) => {
      const client = await signInTestUser(cfg, email, demoLogin());
      const { data, error } = await client
        .from("bookings")
        .select("id, partner_id")
        .in("id", SEED_BOOKING_IDS);

      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(10);
      expect(data!.every((b) => b.partner_id === own)).toBe(true);
      expect(data!.some((b) => b.partner_id === other)).toBe(false);

      const otherSeats = await client
        .from("bookings")
        .select("id")
        .eq("partner_id", other);
      expect(otherSeats.data).toEqual([]);
    });

    it.each([
      ["technician1@airportops.example", "d0000000-0000-0000-0000-000000000001"],
      ["technician2@airportops.example", "d0000000-0000-0000-0000-000000000002"],
      ["technician3@airportops.example", "d0000000-0000-0000-0000-000000000003"],
    ])("should give %s only their own jobs", async (email, technicianId) => {
      const client = await signInTestUser(cfg, email, demoLogin());
      const { data, error } = await client.from("technician_jobs").select("technician_id");

      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(2);
      expect(data!.every((j) => j.technician_id === technicianId)).toBe(true);
    });

    it("should show the technicians work in more than one state, so there is something to do and something done", async () => {
      const client = await signInTestUser(cfg, "technician3@airportops.example", demoLogin());
      const { data } = await client.from("technician_jobs").select("status, job_type");

      expect(new Set(data!.map((j) => j.status)).size).toBeGreaterThanOrEqual(2);
      expect(new Set(data!.map((j) => j.job_type)).size).toBeGreaterThanOrEqual(2);
    });
  });

  describe("honest metrics (spec R5)", () => {
    // Other suites change rows of the database while this one runs, so a figure
    // is compared with a floor made of the seeded rows only, never with a total.
    // That each figure is the count of its rows is proven by the dashboard
    // tests of the RLS suite.
    it.each([
      ["admin@airportops.example", "admin"],
      ["ops.manager@airportops.example", "operations_manager"],
      ["partner.dcr@airportops.example", "partner_user"],
      ["partner.dmo@airportops.example", "partner_user"],
      ["technician1@airportops.example", "technician"],
    ] as const)("should show %s figures counted from the data, with something to demo", async (email, role) => {
      const client = await signInTestUser(cfg, email, demoLogin());
      const results = await getDashboardMetrics(role, client);

      expect(results.length).toBeGreaterThan(0);
      for (const { metric, value } of results) {
        expect(value, `${role}: ${metric.id}`).not.toBeNull();
      }
      expect(results.some((r) => (r.value ?? 0) > 0)).toBe(true);
    });

    it("should count a figure of admin from the seeded rows at least: pending bookings", async () => {
      const seeded = (await rows("bookings", SEED_BOOKING_IDS)).filter((b) => b.status === "pending");
      const client = await signInTestUser(cfg, "admin@airportops.example", demoLogin());
      const pending = (await getDashboardMetrics("admin", client)).find(
        (r) => r.metric.id === "bookings_pending",
      );

      expect(seeded.length).toBeGreaterThanOrEqual(2);
      expect(pending?.value).toBeGreaterThanOrEqual(seeded.length);
    });

    it("should show the operations manager something in each part of the dashboard", async () => {
      const client = await signInTestUser(cfg, "ops.manager@airportops.example", demoLogin());
      const byId = new Map(
        (await getDashboardMetrics("operations_manager", client)).map((r) => [r.metric.id, r.value]),
      );

      for (const id of [
        "seats_available",
        "seats_quarantine",
        "bookings_pending",
        "bookings_in_progress",
        "jobs_assigned",
        "jobs_in_progress",
        "incidents_open",
      ]) {
        expect(byId.get(id), id).toBeGreaterThan(0);
      }
    });
  });

  describe("same data on every load (spec R2, VI-F07-S02)", () => {
    const BASE = "2026-08-01T00:00:00.000Z";

    it("should have every system timestamp of the seeded rows at one fixed moment", async () => {
      const at = (value: string) => new Date(value).toISOString();
      const demoRows = [
        ...(await rows("bookings", SEED_BOOKING_IDS.slice(20))),
        ...(await rows("technician_jobs", JOB_IDS)),
        ...(await demoUsers()),
        // Seats 31 to 40: other suites use the first seats and change them.
        ...(await rows("seats", SEED_SEAT_IDS.slice(30))),
      ];

      expect(demoRows.length).toBeGreaterThan(25);
      for (const row of demoRows) {
        expect(at(row.created_at)).toBe(BASE);
        expect(at(row.updated_at)).toBe(BASE);
      }
    });

    it("should write the audit rows of the seed at fixed times in order: the base moment plus their rank in seconds", async () => {
      const events = await eventsOfBookings(SEED_BOOKING_IDS.slice(20));
      const times = events.map((e) => (new Date(e.created_at).getTime() - Date.parse(BASE)) / 1000);

      expect(events.length).toBeGreaterThan(20);
      expect(times.every((t) => Number.isInteger(t) && t >= 1 && t < 3600)).toBe(true);
      expect(new Set(times).size).toBe(times.length);
    });

    it("should leave every trigger of the database turned on after the load", () => {
      const result = runSql(
        "select count(*) from pg_trigger where not tgisinternal and tgenabled <> 'O';",
      );
      if (!result) return; // No Docker: nothing to ask the database with.

      expect(result.ok, result.output).toBe(true);
      expect(result.output).toMatch(/\b0\b/);
    });
  });

  describe("rerun and real data (spec E1, E2)", () => {
    const demoSql = () => readFileSync(join(process.cwd(), "supabase", "seeds", "demo.sql"), "utf8");
    const baseSql = () => readFileSync(join(process.cwd(), "supabase", "seed.sql"), "utf8");

    const digest = (value: unknown) =>
      createHash("md5").update(JSON.stringify(value)).digest("hex");

    // The content of the rows of the seed that no other suite changes, as a
    // digest per group, so a rerun that changed a single column shows.
    async function fingerprint() {
      const sorted = <T extends { id: string }>(list: T[]) =>
        [...list].sort((a, b) => a.id.localeCompare(b.id));
      const auth = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const eventsOf = (ids: string[]) => eventsOfBookings(ids);

      return {
        demo_users: digest(sorted(await rows("users", undefined, { column: "email", like: "%.example" }))),
        categories: digest(sorted(await rows("seat_categories"))),
        airports: digest(sorted(await rows("airports"))),
        unused_seats: digest(sorted(await rows("seats", SEED_SEAT_IDS.slice(30)))),
        new_bookings: digest(sorted(await rows("bookings", SEED_BOOKING_IDS.slice(20)))),
        new_booking_events: digest(sorted(await eventsOf(SEED_BOOKING_IDS.slice(20)))),
        jobs: digest(sorted(await rows("technician_jobs", JOB_IDS))),
        incidents: digest(sorted(await rows("incidents", INCIDENT_IDS))),
        auth_users: digest(
          auth.data.users
            .filter((u) => u.email?.endsWith("@airportops.example"))
            .map((u) => [u.id, u.email, u.created_at, u.email_confirmed_at])
            .sort(),
        ),
      };
    }

    it("should do nothing, and say so, when the demo seed is loaded again on loaded data", async () => {
      const before = await fingerprint();
      const result = runSql(demoSql());
      if (!result) return; // No Docker: nothing to run it with.

      expect(result.ok, result.output).toBe(true);
      expect(result.output).toContain("already loaded");
      expect(await fingerprint()).toEqual(before);
    });

    it("should fail on nothing, add nothing and change nothing when the base seed is loaded again", async () => {
      const before = await fingerprint();
      const result = runSql(baseSql());
      if (!result) return;

      expect(result.ok, result.output).toBe(true);
      expect(await fingerprint()).toEqual(before);
      expect(await rows("seats", SEED_SEAT_IDS)).toHaveLength(40);
      expect(await rows("bookings", SEED_BOOKING_IDS)).toHaveLength(30);
    });

    it("should not put back a seeded row that was changed since: only a reset does that", () => {
      // Inside a transaction that is rolled back, so the seeded row is not
      // left changed for the checks that run next to this one.
      const result = runSql(`
        begin;
        update public.seats set manufacturer = 'Edited since the load' where id = '${seatId(40)}';
        ${baseSql()}
        ${demoSql()}
        select 'manufacturer=' || manufacturer || ' seats=' || (select count(*) from public.seats where id::text like 'e0000000-%')
          from public.seats where id = '${seatId(40)}';
        rollback;
      `);
      if (!result) return;

      expect(result.ok, result.output).toBe(true);
      expect(result.output).toContain("manufacturer=Edited since the load");
      expect(result.output).toMatch(/seats=40\b/);
    });

    it("should refuse to load, and change nothing, when an account with a real address exists", async () => {
      const before = await fingerprint();
      const result = runSql(`
        begin;
        insert into public.users (id, email, full_name, role, is_active)
        values ('99999999-9999-9999-9999-999999999999', 'someone.real@gmail.com', 'Someone', 'technician', true);
        ${demoSql()}
        rollback;
      `);
      if (!result) return;

      expect(result.ok).toBe(false);
      expect(result.output).toContain("refusing to load demo data");
      expect(await fingerprint()).toEqual(before);
    });
  });
});
