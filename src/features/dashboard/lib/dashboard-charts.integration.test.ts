import { beforeAll, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import { getDashboardCharts, type DashboardChartResult } from "@/features/dashboard/lib/get-dashboard-charts";
import { getDashboardMetrics, type DashboardMetricResult } from "@/features/dashboard/lib/get-dashboard-metrics";
import type { Role } from "@/lib/auth/roles";
import { DEMO_ACCOUNTS, demoLogin } from "@/lib/demo/demo-seed";
import {
  getLocalSupabaseConfig,
  signInTestUser,
  type LocalSupabaseConfig,
} from "@/lib/auth/rls-test-support";

/**
 * VI-F01-S07, AC07 and spec R7: a chart shows the same values as the count cards, for
 * the same user and the same scope. Each demo account signs in, the cards and the
 * charts are read as that account, and every bar that has a card with the same filters
 * must equal it; the open incidents by severity must add up to the open incidents card.
 * The partners must not see the rows of each other. The counts are of the whole scope
 * of the viewer, and other suites change rows while this one runs, so a read is taken
 * again when the cards moved while it was made.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const config = getLocalSupabaseConfig();
const ATTEMPTS = 5;

type Db = SupabaseClient<Database>;

const keyOf = (source: string, filters: Readonly<Record<string, string>>) =>
  `${source}|${JSON.stringify(Object.entries(filters).sort())}`;

interface Reading {
  cards: DashboardMetricResult[];
  charts: DashboardChartResult[];
}

describe.skipIf(!config)("the charts equal the count cards (VI-F01-S07, AC07)", () => {
  const cfg = config as LocalSupabaseConfig;
  const clients = new Map<string, Db>();
  const readings = new Map<string, Reading>();

  async function read(email: string, role: Role): Promise<Reading> {
    const client = clients.get(email)!;
    let last: Reading | null = null;

    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      const before = await getDashboardMetrics(role, client);
      const charts = await getDashboardCharts(role, client);
      const after = await getDashboardMetrics(role, client);

      last = { cards: after, charts };
      const steady = JSON.stringify(before.map((c) => c.value)) === JSON.stringify(after.map((c) => c.value));
      if (steady) return last;

      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    return last!;
  }

  beforeAll(async () => {
    for (const [email, role] of DEMO_ACCOUNTS) {
      clients.set(email, await signInTestUser(cfg, email, demoLogin()));
      readings.set(email, await read(email, role as Role));
    }
  }, 120_000);

  it.each(DEMO_ACCOUNTS)("should give %s (%s) bars that equal the card with the same filters", (email) => {
    const { cards, charts } = readings.get(email)!;
    const byFilters = new Map(cards.map((c) => [keyOf(c.metric.source, c.metric.filters), c]));
    let compared = 0;

    for (const { chart, bars } of charts) {
      for (const bar of bars) {
        const card = byFilters.get(keyOf(chart.source, bar.category.filters));
        if (!card) continue;
        compared++;
        expect(bar.value, `${email}: ${chart.id}/${bar.category.key} against ${card.metric.id}`).toBe(card.value);
      }
    }

    expect(compared, `${email}: no bar had a card to compare with`).toBeGreaterThan(0);
  });

  it.each(DEMO_ACCOUNTS)("should give %s open incidents by severity that add up to the open incidents card", (email) => {
    const { cards, charts } = readings.get(email)!;
    const open = cards.find((c) => c.metric.id === "incidents_open");
    const chart = charts.find((c) => c.chart.id === "open_incidents_by_severity");

    expect(chart, email).toBeDefined();
    expect(open, email).toBeDefined();
    expect(chart!.bars.reduce((sum, bar) => sum + (bar.value ?? NaN), 0), email).toBe(open!.value);
  });

  it.each(DEMO_ACCOUNTS)("should give %s a count for every bar of every chart, never a gap", (email) => {
    const { charts } = readings.get(email)!;

    expect(charts.length).toBeGreaterThan(0);
    for (const { chart, bars } of charts) {
      for (const bar of bars) {
        expect(bar.value, `${email}: ${chart.id}/${bar.category.key}`).not.toBeNull();
      }
    }
  });

  it("should show a partner user only the charts of bookings and incidents, and its own rows", () => {
    for (const email of ["partner.dcr@airportops.example", "partner.dmo@airportops.example"]) {
      expect(readings.get(email)!.charts.map((c) => c.chart.id), email).toEqual([
        "bookings_by_status",
        "open_incidents_by_severity",
      ]);
    }
  });

  it("should never show one partner more of a status than the whole, nor the two together more than the whole", () => {
    const total = (email: string, status: string) =>
      readings
        .get(email)!
        .charts.find((c) => c.chart.id === "bookings_by_status")!
        .bars.find((b) => b.category.key === status)!.value!;

    for (const status of ["pending", "confirmed", "completed", "cancelled", "no_show"]) {
      const whole = total("ops.manager@airportops.example", status);
      const dcr = total("partner.dcr@airportops.example", status);
      const dmo = total("partner.dmo@airportops.example", status);

      expect(dcr, status).toBeLessThanOrEqual(whole);
      expect(dmo, status).toBeLessThanOrEqual(whole);
      expect(dcr + dmo, status).toBeLessThanOrEqual(whole);
    }
  });

  it("should show a technician only the charts of jobs and incidents", () => {
    expect(readings.get("technician1@airportops.example")!.charts.map((c) => c.chart.id)).toEqual([
      "jobs_by_status",
      "open_incidents_by_severity",
    ]);
  });

  it("should give admin and the operations manager the same four charts", () => {
    for (const email of ["admin@airportops.example", "ops.manager@airportops.example"]) {
      expect(readings.get(email)!.charts.map((c) => c.chart.id), email).toHaveLength(4);
    }
  });
});
