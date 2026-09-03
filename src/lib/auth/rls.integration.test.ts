import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import { syncUserProfile } from "@/features/auth/lib/sync-user-profile";
import {
  PARTNER_A_ID,
  PARTNER_B_ID,
  createAnonClient,
  createServiceRoleClient,
  getLocalSupabaseConfig,
  provisionTestIdentities,
  signInTestUser,
  type LocalSupabaseConfig,
  type ProvisionedIdentity,
} from "@/lib/auth/rls-test-support";

/**
 * F05 integration tests: real RLS-enforced queries against the local
 * Postgres/PostgREST instance through real user sessions, per
 * .claude/rules/testing.md ("this cannot be meaningfully unit-tested with
 * a mocked client - the whole point is verifying the database enforces
 * the boundary") and plan.md Task 31.
 *
 * Skips entirely (not "fails") when the local Supabase instance isn't
 * reachable, so `npm test` stays runnable for a dev who hasn't started it
 * - see getLocalSupabaseConfig(). Run `npx supabase start` first.
 */
const config = getLocalSupabaseConfig();

// Seeded from supabase/seed.sql - fixed literal uuids, stable across
// `supabase db reset`. gs=2 -> partner index 1 (ERAC/A); gs=1 -> partner
// index 2 (AFM/B) per the seed's `(gs % 2) + 1` array indexing.
const BOOKING_A_ID = "f0000000-0000-0000-0000-000000000002"; // partner A (ERAC)
const BOOKING_B_ID = "f0000000-0000-0000-0000-000000000001"; // partner B (AFM)
const SEAT_A_ID = "e0000000-0000-0000-0000-000000000002"; // assigned_seat_id of BOOKING_A_ID
const SEAT_B_ID = "e0000000-0000-0000-0000-000000000001"; // assigned_seat_id of BOOKING_B_ID
// Seeded technician with no real Auth account (F03) - only ever used here
// as the *owner* of a fixture row that must NOT be visible to the real
// "technician" test identity, never signed in.
const OTHER_TECHNICIAN_ID = "d0000000-0000-0000-0000-000000000001";

const ALL_18_TABLES = [
  "users",
  "partners",
  "airports",
  "seat_categories",
  "seats",
  "seat_status_history",
  "flights",
  "bookings",
  "booking_events",
  "technician_jobs",
  "installations",
  "cleaning_records",
  "inspection_records",
  "incidents",
  "partner_commercial_terms",
  "settlements",
  "invoices",
  "ai_queries",
] as const;

describe.skipIf(!config)("F05 RLS integration", () => {
  const cfg = config as LocalSupabaseConfig;

  let service: SupabaseClient<Database>;
  let identities: Record<string, ProvisionedIdentity>;

  let adminClient: SupabaseClient<Database>;
  let opsClient: SupabaseClient<Database>;
  let technicianClient: SupabaseClient<Database>;
  let partnerAClient: SupabaseClient<Database>;
  let partnerBClient: SupabaseClient<Database>;
  let inactiveClient: SupabaseClient<Database>;
  let partnerNullClient: SupabaseClient<Database>;
  let anonClient: SupabaseClient<Database>;

  // Fixture row ids created per-run via the service-role client (bypasses
  // RLS - see rls-test-support.ts). Deleted in afterAll.
  const fixtureIds: Record<string, string> = {};

  beforeAll(async () => {
    service = createServiceRoleClient(cfg);
    identities = await provisionTestIdentities(service);

    [
      adminClient,
      opsClient,
      technicianClient,
      partnerAClient,
      partnerBClient,
      inactiveClient,
      partnerNullClient,
    ] = await Promise.all([
      signInTestUser(cfg, identities.admin.email, identities.admin.password),
      signInTestUser(
        cfg,
        identities.opsManager.email,
        identities.opsManager.password,
      ),
      signInTestUser(
        cfg,
        identities.technician.email,
        identities.technician.password,
      ),
      signInTestUser(
        cfg,
        identities.partnerA.email,
        identities.partnerA.password,
      ),
      signInTestUser(
        cfg,
        identities.partnerB.email,
        identities.partnerB.password,
      ),
      signInTestUser(
        cfg,
        identities.inactive.email,
        identities.inactive.password,
      ),
      signInTestUser(
        cfg,
        identities.partnerNull.email,
        identities.partnerNull.password,
      ),
    ]);

    anonClient = createAnonClient(cfg);

    // --- Fixture data for indirect-ownership / partner-isolation tests ---
    // technician_jobs: one owned by the real "technician" identity on a
    // partner-A booking, one owned by a different (unauthenticatable
    // seeded) technician on a partner-B booking.
    const jobOwn = await service
      .from("technician_jobs")
      .insert({
        booking_id: BOOKING_A_ID,
        technician_id: identities.technician.id,
      })
      .select("id")
      .single();
    if (jobOwn.error) throw jobOwn.error;
    fixtureIds.jobOwn = jobOwn.data.id;

    const jobOther = await service
      .from("technician_jobs")
      .insert({
        booking_id: BOOKING_B_ID,
        technician_id: OTHER_TECHNICIAN_ID,
      })
      .select("id")
      .single();
    if (jobOther.error) throw jobOther.error;
    fixtureIds.jobOther = jobOther.data.id;

    const installOwn = await service
      .from("installations")
      .insert({ technician_job_id: fixtureIds.jobOwn })
      .select("id")
      .single();
    if (installOwn.error) throw installOwn.error;
    fixtureIds.installOwn = installOwn.data.id;

    const installOther = await service
      .from("installations")
      .insert({ technician_job_id: fixtureIds.jobOther })
      .select("id")
      .single();
    if (installOther.error) throw installOther.error;
    fixtureIds.installOther = installOther.data.id;

    const cleaningOwn = await service
      .from("cleaning_records")
      .insert({
        seat_id: SEAT_A_ID,
        booking_id: BOOKING_A_ID,
        employee_id: identities.technician.id,
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (cleaningOwn.error) throw cleaningOwn.error;
    fixtureIds.cleaningOwn = cleaningOwn.data.id;

    const cleaningOther = await service
      .from("cleaning_records")
      .insert({
        seat_id: SEAT_B_ID,
        booking_id: BOOKING_B_ID,
        employee_id: OTHER_TECHNICIAN_ID,
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (cleaningOther.error) throw cleaningOther.error;
    fixtureIds.cleaningOther = cleaningOther.data.id;

    const inspectionOwn = await service
      .from("inspection_records")
      .insert({
        seat_id: SEAT_A_ID,
        booking_id: BOOKING_A_ID,
        inspector_id: identities.technician.id,
        inspection_type: "pre_rental",
        result: "pass",
      })
      .select("id")
      .single();
    if (inspectionOwn.error) throw inspectionOwn.error;
    fixtureIds.inspectionOwn = inspectionOwn.data.id;

    const inspectionOther = await service
      .from("inspection_records")
      .insert({
        seat_id: SEAT_B_ID,
        booking_id: BOOKING_B_ID,
        inspector_id: OTHER_TECHNICIAN_ID,
        inspection_type: "pre_rental",
        result: "pass",
      })
      .select("id")
      .single();
    if (inspectionOther.error) throw inspectionOther.error;
    fixtureIds.inspectionOther = inspectionOther.data.id;

    const eventA = await service
      .from("booking_events")
      .insert({ booking_id: BOOKING_A_ID, to_status: "confirmed" })
      .select("id")
      .single();
    if (eventA.error) throw eventA.error;
    fixtureIds.eventA = eventA.data.id;

    const eventB = await service
      .from("booking_events")
      .insert({ booking_id: BOOKING_B_ID, to_status: "confirmed" })
      .select("id")
      .single();
    if (eventB.error) throw eventB.error;
    fixtureIds.eventB = eventB.data.id;

    const incidentA = await service
      .from("incidents")
      .insert({
        partner_id: PARTNER_A_ID,
        booking_id: BOOKING_A_ID,
        type: "seat_damage",
        severity: "low",
        description: "RLS test fixture incident (partner A)",
        reported_by: identities.technician.id,
      })
      .select("id")
      .single();
    if (incidentA.error) throw incidentA.error;
    fixtureIds.incidentA = incidentA.data.id;

    const incidentB = await service
      .from("incidents")
      .insert({
        partner_id: PARTNER_B_ID,
        booking_id: BOOKING_B_ID,
        type: "seat_damage",
        severity: "low",
        description: "RLS test fixture incident (partner B)",
        reported_by: identities.technician.id,
      })
      .select("id")
      .single();
    if (incidentB.error) throw incidentB.error;
    fixtureIds.incidentB = incidentB.data.id;

    const settlementA = await service
      .from("settlements")
      .insert({
        partner_id: PARTNER_A_ID,
        period_start: "2026-08-01",
        period_end: "2026-08-31",
      })
      .select("id")
      .single();
    if (settlementA.error) throw settlementA.error;
    fixtureIds.settlementA = settlementA.data.id;

    const settlementB = await service
      .from("settlements")
      .insert({
        partner_id: PARTNER_B_ID,
        period_start: "2026-08-01",
        period_end: "2026-08-31",
      })
      .select("id")
      .single();
    if (settlementB.error) throw settlementB.error;
    fixtureIds.settlementB = settlementB.data.id;

    const invoiceA = await service
      .from("invoices")
      .insert({
        partner_id: PARTNER_A_ID,
        invoice_number: `RLS-TEST-A-${Date.now()}`,
        issue_date: "2026-09-01",
        due_date: "2026-09-15",
        subtotal: 100,
        total: 100,
      })
      .select("id")
      .single();
    if (invoiceA.error) throw invoiceA.error;
    fixtureIds.invoiceA = invoiceA.data.id;

    const invoiceB = await service
      .from("invoices")
      .insert({
        partner_id: PARTNER_B_ID,
        invoice_number: `RLS-TEST-B-${Date.now()}`,
        issue_date: "2026-09-01",
        due_date: "2026-09-15",
        subtotal: 100,
        total: 100,
      })
      .select("id")
      .single();
    if (invoiceB.error) throw invoiceB.error;
    fixtureIds.invoiceB = invoiceB.data.id;

    const pctA = await service
      .from("partner_commercial_terms")
      .insert({
        partner_id: PARTNER_A_ID,
        partner_share_percent: 70,
        platform_share_percent: 30,
        effective_from: "2026-01-01",
      })
      .select("id")
      .single();
    if (pctA.error) throw pctA.error;
    fixtureIds.pctA = pctA.data.id;

    const pctB = await service
      .from("partner_commercial_terms")
      .insert({
        partner_id: PARTNER_B_ID,
        partner_share_percent: 70,
        platform_share_percent: 30,
        effective_from: "2026-01-01",
      })
      .select("id")
      .single();
    if (pctB.error) throw pctB.error;
    fixtureIds.pctB = pctB.data.id;
  }, 60_000);

  afterAll(async () => {
    if (!service) return;

    // Best-effort cleanup, dependency order (children before parents).
    // Identities are deliberately left in place (see rls-test-support.ts)
    // - `npx supabase db reset` is the actual full-cleanup step, per
    // plan.md Task 32.
    await service
      .from("installations")
      .delete()
      .in("id", [fixtureIds.installOwn, fixtureIds.installOther].filter(Boolean));
    await service
      .from("cleaning_records")
      .delete()
      .in("id", [fixtureIds.cleaningOwn, fixtureIds.cleaningOther].filter(Boolean));
    await service
      .from("inspection_records")
      .delete()
      .in("id", [fixtureIds.inspectionOwn, fixtureIds.inspectionOther].filter(Boolean));
    await service
      .from("technician_jobs")
      .delete()
      .in("id", [fixtureIds.jobOwn, fixtureIds.jobOther].filter(Boolean));
    await service
      .from("booking_events")
      .delete()
      .in("id", [fixtureIds.eventA, fixtureIds.eventB].filter(Boolean));
    await service
      .from("incidents")
      .delete()
      .in("id", [fixtureIds.incidentA, fixtureIds.incidentB].filter(Boolean));
    await service
      .from("invoices")
      .delete()
      .in("id", [fixtureIds.invoiceA, fixtureIds.invoiceB].filter(Boolean));
    await service
      .from("settlements")
      .delete()
      .in("id", [fixtureIds.settlementA, fixtureIds.settlementB].filter(Boolean));
    await service
      .from("partner_commercial_terms")
      .delete()
      .in("id", [fixtureIds.pctA, fixtureIds.pctB].filter(Boolean));
  });

  // ===========================================================================
  // 1. Partner isolation
  // ===========================================================================
  describe("partner isolation", () => {
    it("partner A sees only its own bookings; zero rows (not an error) for partner B's", async () => {
      const { data: own, error: ownError } = await partnerAClient
        .from("bookings")
        .select("id, partner_id");
      expect(ownError).toBeNull();
      expect(own!.length).toBeGreaterThan(0);
      expect(own!.every((b) => b.partner_id === PARTNER_A_ID)).toBe(true);

      const { data: cross, error: crossError } = await partnerAClient
        .from("bookings")
        .select("id")
        .eq("id", BOOKING_B_ID);
      expect(crossError).toBeNull();
      expect(cross).toEqual([]);
    });

    it("partner B sees only its own bookings (symmetric check); zero rows for partner A's", async () => {
      const { data: own, error: ownError } = await partnerBClient
        .from("bookings")
        .select("id, partner_id");
      expect(ownError).toBeNull();
      expect(own!.length).toBeGreaterThan(0);
      expect(own!.every((b) => b.partner_id === PARTNER_B_ID)).toBe(true);

      const { data: cross, error: crossError } = await partnerBClient
        .from("bookings")
        .select("id")
        .eq("id", BOOKING_A_ID);
      expect(crossError).toBeNull();
      expect(cross).toEqual([]);
    });

    it("partner A sees only its own settlements; zero rows for partner B's", async () => {
      const { data: own } = await partnerAClient
        .from("settlements")
        .select("id")
        .eq("id", fixtureIds.settlementA);
      expect(own).toHaveLength(1);

      const { data: cross, error } = await partnerAClient
        .from("settlements")
        .select("id")
        .eq("id", fixtureIds.settlementB);
      expect(error).toBeNull();
      expect(cross).toEqual([]);
    });

    it("partner A sees only its own invoices; zero rows for partner B's", async () => {
      const { data: own } = await partnerAClient
        .from("invoices")
        .select("id")
        .eq("id", fixtureIds.invoiceA);
      expect(own).toHaveLength(1);

      const { data: cross, error } = await partnerAClient
        .from("invoices")
        .select("id")
        .eq("id", fixtureIds.invoiceB);
      expect(error).toBeNull();
      expect(cross).toEqual([]);
    });

    it("partner A sees only its own partner_commercial_terms; zero rows for partner B's", async () => {
      const { data: own } = await partnerAClient
        .from("partner_commercial_terms")
        .select("id")
        .eq("id", fixtureIds.pctA);
      expect(own).toHaveLength(1);

      const { data: cross, error } = await partnerAClient
        .from("partner_commercial_terms")
        .select("id")
        .eq("id", fixtureIds.pctB);
      expect(error).toBeNull();
      expect(cross).toEqual([]);
    });

    it("partner A sees only its own incidents; zero rows for partner B's", async () => {
      const { data: own } = await partnerAClient
        .from("incidents")
        .select("id")
        .eq("id", fixtureIds.incidentA);
      expect(own).toHaveLength(1);

      const { data: cross, error } = await partnerAClient
        .from("incidents")
        .select("id")
        .eq("id", fixtureIds.incidentB);
      expect(error).toBeNull();
      expect(cross).toEqual([]);
    });
  });

  // ===========================================================================
  // 2. users self-protection (Task 4 trigger + Task 5 policy)
  // ===========================================================================
  describe("users self-protection", () => {
    it("blocks a partner_user from changing their own role via UPDATE", async () => {
      const { error } = await partnerAClient
        .from("users")
        .update({ role: "admin" })
        .eq("id", identities.partnerA.id);
      expect(error).not.toBeNull();

      const { data } = await service
        .from("users")
        .select("role")
        .eq("id", identities.partnerA.id)
        .single();
      expect(data?.role).toBe("partner_user");
    });

    it("blocks a partner_user from changing their own partner_id via UPDATE", async () => {
      const { error } = await partnerAClient
        .from("users")
        .update({ partner_id: PARTNER_B_ID })
        .eq("id", identities.partnerA.id);
      expect(error).not.toBeNull();

      const { data } = await service
        .from("users")
        .select("partner_id")
        .eq("id", identities.partnerA.id)
        .single();
      expect(data?.partner_id).toBe(PARTNER_A_ID);
    });

    it("blocks a partner_user from changing their own is_active via UPDATE", async () => {
      const { error } = await partnerAClient
        .from("users")
        .update({ is_active: false })
        .eq("id", identities.partnerA.id);
      expect(error).not.toBeNull();

      const { data } = await service
        .from("users")
        .select("is_active")
        .eq("id", identities.partnerA.id)
        .single();
      expect(data?.is_active).toBe(true);
    });

    it("allows a partner_user to update a non-sensitive column (full_name) on their own row", async () => {
      const { error } = await partnerAClient
        .from("users")
        .update({ full_name: "Updated By Self" })
        .eq("id", identities.partnerA.id);
      expect(error).toBeNull();

      const { data } = await service
        .from("users")
        .select("full_name")
        .eq("id", identities.partnerA.id)
        .single();
      expect(data?.full_name).toBe("Updated By Self");

      // restore for other tests / re-runs
      await service
        .from("users")
        .update({ full_name: "RLS Test Partner A User" })
        .eq("id", identities.partnerA.id);
    });

    it("rejects (matches zero rows) when a partner_user tries to update another user's row", async () => {
      const { data, error } = await partnerAClient
        .from("users")
        .update({ full_name: "Hacked By Partner A" })
        .eq("id", identities.partnerB.id)
        .select();
      expect(error).toBeNull();
      expect(data).toEqual([]);

      const { data: check } = await service
        .from("users")
        .select("full_name")
        .eq("id", identities.partnerB.id)
        .single();
      expect(check?.full_name).not.toBe("Hacked By Partner A");
    });
  });

  // ===========================================================================
  // 3. Role boundaries
  // ===========================================================================
  describe("role boundaries", () => {
    it("technician sees only their own technician_jobs; zero rows for another technician's", async () => {
      const { data: own } = await technicianClient
        .from("technician_jobs")
        .select("id")
        .eq("id", fixtureIds.jobOwn);
      expect(own).toHaveLength(1);

      const { data: other, error } = await technicianClient
        .from("technician_jobs")
        .select("id")
        .eq("id", fixtureIds.jobOther);
      expect(error).toBeNull();
      expect(other).toEqual([]);
    });

    it("technician sees only installations on their own job; zero rows for another technician's job", async () => {
      const { data: own } = await technicianClient
        .from("installations")
        .select("id")
        .eq("id", fixtureIds.installOwn);
      expect(own).toHaveLength(1);

      const { data: other, error } = await technicianClient
        .from("installations")
        .select("id")
        .eq("id", fixtureIds.installOther);
      expect(error).toBeNull();
      expect(other).toEqual([]);
    });

    it("technician sees only their own cleaning_records; zero rows for another technician's", async () => {
      const { data: own } = await technicianClient
        .from("cleaning_records")
        .select("id")
        .eq("id", fixtureIds.cleaningOwn);
      expect(own).toHaveLength(1);

      const { data: other, error } = await technicianClient
        .from("cleaning_records")
        .select("id")
        .eq("id", fixtureIds.cleaningOther);
      expect(error).toBeNull();
      expect(other).toEqual([]);
    });

    it("technician sees only their own inspection_records; zero rows for another technician's", async () => {
      const { data: own } = await technicianClient
        .from("inspection_records")
        .select("id")
        .eq("id", fixtureIds.inspectionOwn);
      expect(own).toHaveLength(1);

      const { data: other, error } = await technicianClient
        .from("inspection_records")
        .select("id")
        .eq("id", fixtureIds.inspectionOther);
      expect(error).toBeNull();
      expect(other).toEqual([]);
    });

    it("operations_manager can read settlements/invoices/partner_commercial_terms across both partners", async () => {
      const { data: settlements } = await opsClient
        .from("settlements")
        .select("id");
      expect(settlements?.some((s) => s.id === fixtureIds.settlementA)).toBe(
        true,
      );
      expect(settlements?.some((s) => s.id === fixtureIds.settlementB)).toBe(
        true,
      );

      const { data: invoices } = await opsClient.from("invoices").select("id");
      expect(invoices?.some((i) => i.id === fixtureIds.invoiceA)).toBe(true);
      expect(invoices?.some((i) => i.id === fixtureIds.invoiceB)).toBe(true);

      const { data: pcts } = await opsClient
        .from("partner_commercial_terms")
        .select("id");
      expect(pcts?.some((p) => p.id === fixtureIds.pctA)).toBe(true);
      expect(pcts?.some((p) => p.id === fixtureIds.pctB)).toBe(true);
    });

    it("operations_manager cannot INSERT a settlement (admin-only per the migration)", async () => {
      const { error } = await opsClient.from("settlements").insert({
        partner_id: PARTNER_A_ID,
        period_start: "2026-08-01",
        period_end: "2026-08-31",
      });
      expect(error).not.toBeNull();
    });

    it("operations_manager cannot INSERT an invoice (admin-only)", async () => {
      const { error } = await opsClient.from("invoices").insert({
        partner_id: PARTNER_A_ID,
        invoice_number: `RLS-TEST-OPS-DENIED-${Date.now()}`,
        issue_date: "2026-09-01",
        due_date: "2026-09-15",
        subtotal: 50,
        total: 50,
      });
      expect(error).not.toBeNull();
    });

    it("operations_manager cannot INSERT a partner_commercial_terms row (admin-only)", async () => {
      const { error } = await opsClient.from("partner_commercial_terms").insert({
        partner_id: PARTNER_A_ID,
        partner_share_percent: 60,
        platform_share_percent: 40,
        effective_from: "2026-01-01",
      });
      expect(error).not.toBeNull();
    });

    it("admin (unlike operations_manager) can INSERT a settlement", async () => {
      const { data, error } = await adminClient
        .from("settlements")
        .insert({
          partner_id: PARTNER_A_ID,
          period_start: "2026-07-01",
          period_end: "2026-07-31",
        })
        .select("id")
        .single();
      expect(error).toBeNull();
      expect(data?.id).toBeDefined();

      if (data) {
        await service.from("settlements").delete().eq("id", data.id);
      }
    });
  });

  // ===========================================================================
  // 4. Anonymous denial (all 18 tables, including USING(true) reference tables)
  // ===========================================================================
  describe("anonymous denial", () => {
    it.each(ALL_18_TABLES)(
      "anonymous client gets zero rows (not real data) on %s",
      async (table) => {
        const { data, error } = await anonClient.from(table).select("*").limit(1);

        if (error) {
          // A clean permission error is an acceptable deny outcome too.
          expect(error).not.toBeNull();
        } else {
          expect(data).toEqual([]);
        }
      },
    );

    it("anonymous client specifically gets zero rows on the USING(true) reference tables (to authenticated actually gates anon)", async () => {
      const [airports, seatCategories, flights] = await Promise.all([
        anonClient.from("airports").select("id"),
        anonClient.from("seat_categories").select("id"),
        anonClient.from("flights").select("id"),
      ]);

      expect(airports.data ?? []).toEqual([]);
      expect(seatCategories.data ?? []).toEqual([]);
      expect(flights.data ?? []).toEqual([]);
    });
  });

  // ===========================================================================
  // 5. NULL partner_id behavior
  // ===========================================================================
  describe("NULL partner_id behavior", () => {
    it("a partner_user with partner_id null gets zero rows (not an error, not all rows) on every partner-scoped table", async () => {
      const tables = [
        "bookings",
        "settlements",
        "invoices",
        "partner_commercial_terms",
        "incidents",
      ] as const;

      for (const table of tables) {
        const { data, error } = await partnerNullClient
          .from(table)
          .select("id");
        expect(error).toBeNull();
        expect(data).toEqual([]);
      }
    });

    it("an inactive user gets zero rows on partner-scoped data even though they can still sign in", async () => {
      const { data, error } = await inactiveClient.from("bookings").select("id");
      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  });

  // ===========================================================================
  // 6. Indirect-ownership tables (join-based policies actually filter)
  // ===========================================================================
  describe("indirect-ownership tables", () => {
    it("partner A sees booking_events only for its own booking; zero rows for partner B's", async () => {
      const { data: own } = await partnerAClient
        .from("booking_events")
        .select("id")
        .eq("id", fixtureIds.eventA);
      expect(own).toHaveLength(1);

      const { data: other, error } = await partnerAClient
        .from("booking_events")
        .select("id")
        .eq("id", fixtureIds.eventB);
      expect(error).toBeNull();
      expect(other).toEqual([]);
    });

    it("technician sees booking_events only for bookings they are linked to via technician_jobs; zero rows for the other booking", async () => {
      const { data: own } = await technicianClient
        .from("booking_events")
        .select("id")
        .eq("id", fixtureIds.eventA);
      expect(own).toHaveLength(1);

      const { data: other, error } = await technicianClient
        .from("booking_events")
        .select("id")
        .eq("id", fixtureIds.eventB);
      expect(error).toBeNull();
      expect(other).toEqual([]);
    });

    it("partner A sees technician_jobs only for its own booking; zero rows for partner B's booking's job", async () => {
      const { data: own } = await partnerAClient
        .from("technician_jobs")
        .select("id")
        .eq("id", fixtureIds.jobOwn);
      expect(own).toHaveLength(1);

      const { data: other, error } = await partnerAClient
        .from("technician_jobs")
        .select("id")
        .eq("id", fixtureIds.jobOther);
      expect(error).toBeNull();
      expect(other).toEqual([]);
    });

    it("partner A sees installations only via its own booking's job; zero rows for partner B's", async () => {
      const { data: own } = await partnerAClient
        .from("installations")
        .select("id")
        .eq("id", fixtureIds.installOwn);
      expect(own).toHaveLength(1);

      const { data: other, error } = await partnerAClient
        .from("installations")
        .select("id")
        .eq("id", fixtureIds.installOther);
      expect(error).toBeNull();
      expect(other).toEqual([]);
    });

    it("partner A sees cleaning_records only for its own booking; zero rows for partner B's", async () => {
      const { data: own } = await partnerAClient
        .from("cleaning_records")
        .select("id")
        .eq("id", fixtureIds.cleaningOwn);
      expect(own).toHaveLength(1);

      const { data: other, error } = await partnerAClient
        .from("cleaning_records")
        .select("id")
        .eq("id", fixtureIds.cleaningOther);
      expect(error).toBeNull();
      expect(other).toEqual([]);
    });

    it("partner A sees inspection_records only for its own booking; zero rows for partner B's", async () => {
      const { data: own } = await partnerAClient
        .from("inspection_records")
        .select("id")
        .eq("id", fixtureIds.inspectionOwn);
      expect(own).toHaveLength(1);

      const { data: other, error } = await partnerAClient
        .from("inspection_records")
        .select("id")
        .eq("id", fixtureIds.inspectionOther);
      expect(error).toBeNull();
      expect(other).toEqual([]);
    });
  });

  // ===========================================================================
  // 7. RLS recursion (42P17) - specifically the bookings <-> technician_jobs
  // pair that recursed before booking_partner_id() was added (see the
  // migration's comment above that function).
  // ===========================================================================
  describe("RLS recursion fix (booking_partner_id)", () => {
    it("technician reading bookings does not trigger infinite recursion (42P17)", async () => {
      const { data, error } = await technicianClient
        .from("bookings")
        .select("id");
      expect(error).toBeNull();
      expect(data!.some((b) => b.id === BOOKING_A_ID)).toBe(true);
    });

    it("partner_user reading technician_jobs does not trigger infinite recursion (42P17), exercising booking_partner_id()", async () => {
      const { data, error } = await partnerAClient
        .from("technician_jobs")
        .select("id");
      expect(error).toBeNull();
      expect(data!.some((j) => j.id === fixtureIds.jobOwn)).toBe(true);
    });
  });

  // ===========================================================================
  // 8. Signup flow regression (live RLS INSERT policy on public.users)
  // ===========================================================================
  describe("signup flow regression", () => {
    it("syncUserProfile() (signup.action.ts's immediate-session branch) creates the public.users row end-to-end under real RLS", async () => {
      const anon = createAnonClient(cfg);
      const email = `rls-signup-regression-${Date.now()}@test.local`;

      const { data: signUpData, error: signUpError } = await anon.auth.signUp({
        email,
        password: "SignupRegression123!",
        options: { data: { full_name: "Signup Regression User" } },
      });
      expect(signUpError).toBeNull();
      // Local config has email confirmation disabled (supabase/config.toml
      // auth.email.enable_confirmations = false), so a session - and a real
      // auth.uid() - is returned immediately, exactly like the branch in
      // signup.action.ts this test exercises. The email-confirmation-enabled
      // branch (api/auth/confirm/route.ts) is covered separately by the
      // mocked route test, since it can't be driven end-to-end without
      // flipping local Auth config.
      expect(signUpData.session).not.toBeNull();

      const { error: syncError } = await syncUserProfile(anon, {
        id: signUpData.user!.id,
        email,
        full_name: "Signup Regression User",
      });
      expect(syncError).toBeNull();

      const { data: row } = await service
        .from("users")
        .select("id, email, role, partner_id")
        .eq("id", signUpData.user!.id)
        .single();
      expect(row).toMatchObject({
        email,
        role: "partner_user",
        partner_id: null,
      });

      await service.auth.admin.deleteUser(signUpData.user!.id);
    });
  });
});
