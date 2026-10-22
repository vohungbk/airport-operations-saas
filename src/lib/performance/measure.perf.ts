import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { arch, platform } from "node:os";

import { createServerClient } from "@supabase/ssr";
import { describe, expect, it } from "vitest";

import type { Database } from "@/types/database.types";
import { getLocalSupabaseConfig, signInTestUser } from "@/lib/auth/rls-test-support";
import {
  CATEGORY_IDS,
  DCR,
  DXB,
  INCIDENT_IDS,
  JOB_IDS,
  bookingId,
  demoLogin,
  seatId,
} from "@/lib/demo/demo-seed";
import { WORKFLOWS, buildReport, summarize, type Measured } from "@/lib/performance/measure";
import { AGREED_TARGETS, validateTargets } from "@/lib/performance/targets";

/**
 * VI-F08-S06 (spec R6, E2): measures the key workflows of a running app and writes
 * reports/performance.md. Run it with `npm run perf:measure` (see docs/performance.md).
 *
 * It signs in as the demo admin of the LOCAL database and refuses anything else, so
 * it can never touch a shared one. It times one request after another (one user),
 * after one warm-up request each, and reports the figures. A verdict is given only for
 * a workflow that has a complete agreed target (src/lib/performance/targets.ts).
 *
 * The "create a booking" run adds bookings to the local database, which cannot be
 * deleted (their events are append-only); `npm run demo:reset` puts it back. Set
 * PERF_CREATE=0 to leave it out.
 *   PERF_BASE_URL       the app, default http://localhost:3000 (must be local)
 *   PERF_RUNS           timed requests per page, default 20
 *   PERF_CREATE_RUNS    timed creates, default 5
 */
const BASE_URL = (process.env.PERF_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const RUNS = Number(process.env.PERF_RUNS ?? 20);
const CREATE_RUNS = Number(process.env.PERF_CREATE_RUNS ?? 5);
const CREATE = process.env.PERF_CREATE !== "0";

const isLocal = (url: string) => /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(new URL(url).origin);

function commit(): string {
  try {
    const sha = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    const dirty = execSync("git status --porcelain", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    return dirty ? `${sha} (with uncommitted changes)` : sha;
  } catch {
    return "unknown";
  }
}

describe("performance of the key workflows (VI-F08-S06)", () => {
  it("should measure the list, detail and create workflows and write the report", async () => {
    const config = getLocalSupabaseConfig();
    if (!config) {
      throw new Error("The local Supabase stack is not running (or is not local). Start it with: npx supabase start");
    }
    if (!isLocal(BASE_URL)) {
      throw new Error(`Refusing to measure ${BASE_URL}: this signs in with the demo account, so the app must be local.`);
    }

    // The mode decides how far the numbers can be trusted.
    const login = await fetch(`${BASE_URL}/login`).catch(() => null);
    if (!login?.ok) {
      throw new Error(`The app does not answer at ${BASE_URL}. Start it (npm run build && npm start) and run this again.`);
    }
    const mode = (await login.text()).includes("development") ? "development" : "production";

    // Sign in the way the app does, keeping the session cookies in memory.
    const jar = new Map<string, string>();
    const supabase = createServerClient<Database>(config.apiUrl, config.anonKey, {
      cookies: {
        getAll: () => [...jar].map(([name, value]) => ({ name, value })),
        setAll: (cookies) => cookies.forEach(({ name, value }) => jar.set(name, value)),
      },
    });
    const signedIn = await signInTestUser(config, "admin@airportops.example", demoLogin());
    const { data: current } = await signedIn.auth.getSession();
    expect(current.session, "sign in").not.toBeNull();
    const { error } = await supabase.auth.setSession({
      access_token: current.session!.access_token,
      refresh_token: current.session!.refresh_token,
    });
    expect(error, "keep the session as cookies").toBeNull();
    const cookie = [...jar].map(([name, value]) => `${name}=${value}`).join("; ");

    /** Milliseconds until the whole page has arrived. */
    async function timePage(path: string): Promise<number> {
      const started = performance.now();
      const response = await fetch(`${BASE_URL}${path}`, { headers: { cookie }, redirect: "manual" });
      await response.text();
      const elapsed = performance.now() - started;
      expect(response.status, `${path} (a redirect means the session was not accepted)`).toBe(200);
      return elapsed;
    }

    async function measurePage(id: string, path: string): Promise<Measured> {
      await timePage(path); // warm-up: not counted
      const times: number[] = [];
      for (let i = 0; i < RUNS; i++) times.push(await timePage(path));
      return { workflow: WORKFLOWS.find((w) => w.id === id)!, stats: summarize(times) };
    }

    const measured: Measured[] = [
      await measurePage("list:bookings", "/bookings"),
      await measurePage("list:seats", "/seats"),
      await measurePage("list:jobs", "/jobs"),
      await measurePage("list:incidents", "/incidents"),
      await measurePage("detail:booking", `/bookings/${bookingId(21)}`),
      await measurePage("detail:seat", `/seats/${seatId(21)}`),
      await measurePage("detail:job", `/jobs/${JOB_IDS[0]}`),
      await measurePage("detail:incident", `/incidents/${INCIDENT_IDS[0]}`),
      await measurePage("create:booking-form", "/bookings/new"),
    ];

    if (CREATE) {
      const times: number[] = [];
      for (let i = 0; i < CREATE_RUNS + 1; i++) {
        const started = performance.now();
        const { error: createError } = await supabase.rpc("create_booking", {
          p_partner_id: DCR,
          p_airport_id: DXB,
          p_seat_category_id: CATEGORY_IDS[0],
          p_pickup_at: "2031-01-01T10:00:00Z",
          p_return_at: "2031-01-04T10:00:00Z",
          p_daily_rate: 10,
          p_notes: "performance measurement",
        });
        const elapsed = performance.now() - started;
        expect(createError, "create_booking").toBeNull();
        if (i > 0) times.push(elapsed); // the first is the warm-up
      }
      measured.push({
        workflow: WORKFLOWS.find((w) => w.id === "create:booking")!,
        stats: summarize(times),
        note: `${CREATE_RUNS + 1} bookings added to the local database`,
      });
    }

    const { valid, rejected } = validateTargets(AGREED_TARGETS);
    const report = buildReport({
      measuredAt: new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC",
      commit: commit(),
      mode,
      environment: `node ${process.version}, ${platform()} ${arch()}`,
      measured,
      targets: valid,
      rejected,
    });

    mkdirSync("reports", { recursive: true });
    writeFileSync(join("reports", "performance.md"), report);
    console.log(`\n${report}\nWritten to reports/performance.md`);

    expect(measured.length).toBeGreaterThanOrEqual(CREATE ? 10 : 9);
    if (valid.length === 0) {
      expect(report).toContain("No performance target is agreed");
    }
  });
});
