import { beforeAll, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import type { Role } from "@/lib/auth/roles";
import { getDashboardMetrics } from "@/features/dashboard/lib/get-dashboard-metrics";
import type { DashboardMetric } from "@/features/dashboard/lib/dashboard-metrics";
import { DCR, DEMO_ACCOUNTS, DMO, USER_IDS, demoLogin } from "@/lib/demo/demo-seed";
import {
  createServiceRoleClient,
  getLocalSupabaseConfig,
  signInTestUser,
  type LocalSupabaseConfig,
} from "@/lib/auth/rls-test-support";

/**
 * VI-F07-S05 (spec R5): the figures of the dashboards are calculated from the
 * seeded data, not hardcoded. For each demo account, each figure is compared
 * with a count made here, in another way: the rows are read with the service
 * role and the scope of the role is applied by the rules below (the rules of
 * the RLS policies, written as the expected result). The dashboard counts the
 * whole scope of the viewer, not only the seeded rows, and other suites change
 * rows while this one runs; so the rows are read before and after the figures,
 * and the figures are compared only when both reads are the same.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const config = getLocalSupabaseConfig();

type Db = SupabaseClient<Database>;
type Tables = Database["public"]["Tables"];

interface Snapshot {
  seats: Tables["seats"]["Row"][];
  bookings: Tables["bookings"]["Row"][];
  technician_jobs: Tables["technician_jobs"]["Row"][];
  incidents: Tables["incidents"]["Row"][];
}

const ATTEMPTS = 5;
const RETRY_DELAY_MS = 300;
// The default max-rows of the local API: a page can not be longer.
const PAGE_SIZE = 1000;

describe.skipIf(!config)("dashboard figures are counted from the seeded data (VI-F07-S05)", () => {
  const cfg = config as LocalSupabaseConfig;
  let service: Db;
  const clients = new Map<string, Db>();

  /** Every row of the table, page by page: other suites leave thousands of rows behind. */
  async function readAll<T extends keyof Snapshot>(table: T): Promise<Snapshot[T]> {
    const rows: unknown[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await service
        .from(table)
        .select("*")
        .order("id")
        .range(from, from + PAGE_SIZE - 1);
      expect(error, String(table)).toBeNull();
      rows.push(...(data ?? []));
      if ((data?.length ?? 0) < PAGE_SIZE) return rows as Snapshot[T];
    }
  }

  async function snapshot(): Promise<Snapshot> {
    return {
      seats: await readAll("seats"),
      bookings: await readAll("bookings"),
      technician_jobs: await readAll("technician_jobs"),
      incidents: await readAll("incidents"),
    };
  }

  /** The rows of each table that the account can see, by the rules of its role. */
  function scopeOf(email: string, role: Role, s: Snapshot): Snapshot {
    if (role === "admin" || role === "operations_manager") return s;

    if (role === "partner_user") {
      const own = email.includes(".dcr@") ? DCR : DMO;
      const bookings = s.bookings.filter((b) => b.partner_id === own);
      const bookingIds = new Set(bookings.map((b) => b.id));

      // No seat figure is shown to a partner user: an empty scope fails loudly if one appears.
      return {
        bookings,
        seats: [],
        technician_jobs: s.technician_jobs.filter((j) => bookingIds.has(j.booking_id)),
        incidents: s.incidents.filter((i) => i.partner_id === own),
      };
    }

    const userId = Object.values(USER_IDS)[DEMO_ACCOUNTS.findIndex(([e]) => e === email)];
    const jobs = s.technician_jobs.filter((j) => j.technician_id === userId);
    const jobIds = new Set(jobs.map((j) => j.id));
    const jobBookingIds = new Set(jobs.map((j) => j.booking_id));
    const bookings = s.bookings.filter(
      (b) => b.assigned_technician_id === userId || jobBookingIds.has(b.id),
    );

    // No seat figure is shown to a technician: an empty scope fails loudly if one appears.
    return {
      bookings,
      technician_jobs: jobs,
      seats: [],
      incidents: s.incidents.filter(
        (i) => i.reported_by === userId || (i.technician_job_id && jobIds.has(i.technician_job_id)),
      ),
    };
  }

  function countOf(rows: readonly object[], metric: DashboardMetric): number {
    return rows.filter((row) =>
      Object.entries(metric.filters).every(([column, value]) => (row as Record<string, unknown>)[column] === value),
    ).length;
  }

  const figureCache = new Map<string, ReturnType<typeof readFigures>>();

  /** Every figure of the account, with the count of its rows made here (read once per account). */
  function figuresOf(email: string, role: Role) {
    if (!figureCache.has(email)) figureCache.set(email, readFigures(email, role));
    return figureCache.get(email)!;
  }

  async function readFigures(email: string, role: Role) {
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      const before = await snapshot();
      const results = await getDashboardMetrics(role, clients.get(email)!);
      const after = await snapshot();

      const expectedOf = (s: Snapshot) =>
        results.map(({ metric }) => countOf(scopeOf(email, role, s)[metric.source], metric));
      const expected = expectedOf(before);
      const figures = results.map(({ metric, value }, i) => ({
        id: metric.id,
        value,
        expected: expected[i],
      }));

      // Other suites change rows while this one runs, and a change can come and go between
      // the reads. A figure that is wrong because of the code is wrong on every attempt, so
      // a difference is read again; the last attempt is returned as it is, to be asserted.
      const steady = JSON.stringify(expected) === JSON.stringify(expectedOf(after));
      const equal = figures.every((f) => f.value === f.expected);
      if ((steady && equal) || attempt === ATTEMPTS) return figures;

      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
    throw new Error("unreachable");
  }

  beforeAll(async () => {
    service = createServiceRoleClient(cfg);
    const { data } = await service.from("bookings").select("id").limit(1);
    if (!data?.length) {
      throw new Error("The demo data is not loaded. Run `npm run demo:reset`.");
    }
    for (const [email] of DEMO_ACCOUNTS) {
      clients.set(email, await signInTestUser(cfg, email, demoLogin()));
    }
  }, 60_000);

  describe("each figure is the count of its rows", () => {
    it.each(DEMO_ACCOUNTS)(
      "should show %s (%s) every figure equal to the count of the seeded rows in its scope",
      async (email, role) => {
        const figures = await figuresOf(email, role);

        expect(figures.length).toBeGreaterThan(0);
        for (const { id, value, expected } of figures) {
          expect(value, `${email}: ${id}`).toBe(expected);
        }
      },
    );

    it("should show a figure with no rows as 0 and not as a gap", async () => {
      const figures = (
        await Promise.all(DEMO_ACCOUNTS.map(([email, role]) => figuresOf(email, role)))
      ).flat();
      const empty = figures.filter((f) => f.expected === 0);

      expect(empty.length).toBeGreaterThan(0);
      for (const { id, value } of empty) {
        expect(value, id).toBe(0);
      }
    });
  });

  describe("no figure is a constant", () => {
    it("should give the same figure different values for different accounts, so no fixed number can match them all", async () => {
      const byAccount = new Map<string, Map<string, number | null>>();
      for (const [email, role] of DEMO_ACCOUNTS) {
        const figures = await figuresOf(email, role);
        byAccount.set(email, new Map(figures.map((f) => [f.id, f.value])));
      }

      const values = (id: string) =>
        new Set(
          [...byAccount.values()].map((m) => m.get(id)).filter((v): v is number => v !== undefined),
        );

      expect(values("incidents_open").size).toBeGreaterThan(1);
      expect(values("bookings_pending").size).toBeGreaterThan(1);
    });

    it("should give the two partners figures that never overlap, so together they are at most what the operations manager sees", async () => {
      // The figures of each account are checked against their own rows above; here the
      // expected counts (one consistent read each) must add up across the scopes.
      const dcr = await figuresOf("partner.dcr@airportops.example", "partner_user");
      const dmo = await figuresOf("partner.dmo@airportops.example", "partner_user");
      const ops = await figuresOf("ops.manager@airportops.example", "operations_manager");
      const pick = (list: typeof ops, id: string) => list.find((f) => f.id === id)!;

      for (const id of ["bookings_pending", "bookings_in_progress", "incidents_open"]) {
        // A partner never sees the other's rows, so the two can only add up to the whole or less.
        expect(pick(dcr, id).value! + pick(dmo, id).value!, id).toBeLessThanOrEqual(
          pick(ops, id).value!,
        );
      }
    });
  });
});
