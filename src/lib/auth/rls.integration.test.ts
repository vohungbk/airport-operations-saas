import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import { JOB_DETAIL_SELECT } from "@/features/jobs/lib/get-job-by-id";
import { JOB_LIST_SELECT as JOB_LIST_QUERY_SELECT } from "@/features/jobs/lib/get-jobs";
import {
  ACTIVE_BOOKING_STATUSES,
  BOOKING_STATUSES,
  getAllowedManualTransitions,
  isBookingEditable,
  isReasonRequired,
} from "@/features/bookings/lib/booking-status";
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
    // booking_events is append-only for every role since F11 (immutability
    // trigger), so the eventA/eventB fixtures cannot be deleted here; they
    // stay until `supabase db reset`.
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
  // FO-F01-S02: job list reads technician_jobs with booking/technician embeds
  // ===========================================================================
  describe("job list access (FO-F01-S02)", () => {
    const JOB_LIST_SELECT = JOB_LIST_QUERY_SELECT;

    it("admin and operations_manager see every job with its booking number and technician", async () => {
      for (const client of [adminClient, opsClient]) {
        const { data, error } = await client
          .from("technician_jobs")
          .select(JOB_LIST_SELECT)
          .in("id", [fixtureIds.jobOwn, fixtureIds.jobOther]);

        expect(error).toBeNull();
        expect(data).toHaveLength(2);
        for (const job of data!) {
          expect((job as { booking: { booking_number: string } }).booking.booking_number).toMatch(/^BK-/);
        }
      }
    });

    it("filters jobs by booking number through the embedded booking", async () => {
      const { data: booking } = await service
        .from("bookings")
        .select("booking_number")
        .eq("id", BOOKING_A_ID)
        .single();

      const { data, error } = await opsClient
        .from("technician_jobs")
        .select(JOB_LIST_SELECT)
        .in("id", [fixtureIds.jobOwn, fixtureIds.jobOther])
        .ilike("booking.booking_number", booking!.booking_number);

      expect(error).toBeNull();
      expect(data!.map((job) => job.id)).toEqual([fixtureIds.jobOwn]);
    });

    it("technician list query returns only their own job", async () => {
      const { data, error } = await technicianClient
        .from("technician_jobs")
        .select(JOB_LIST_SELECT);

      expect(error).toBeNull();
      expect(data!.map((job) => job.id)).toContain(fixtureIds.jobOwn);
      expect(data!.map((job) => job.id)).not.toContain(fixtureIds.jobOther);
    });

    it("technician filtering by another technician's id gets no jobs", async () => {
      const { data, error } = await technicianClient
        .from("technician_jobs")
        .select(JOB_LIST_SELECT)
        .eq("technician_id", OTHER_TECHNICIAN_ID);

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it("partner_user and anonymous clients cannot list jobs outside their own partner's bookings", async () => {
      const { data, error } = await partnerAClient
        .from("technician_jobs")
        .select(JOB_LIST_SELECT);

      expect(error).toBeNull();
      expect(data!.map((job) => job.id)).not.toContain(fixtureIds.jobOther);

      const anon = await anonClient.from("technician_jobs").select("id");
      expect(anon.data ?? []).toEqual([]);
    });
  });

  // ===========================================================================
  // FO-F01-S03: job detail reads one technician_jobs row with minimal embeds
  // ===========================================================================
  describe("job detail access (FO-F01-S03)", () => {
    it("technician can read the detail of their own job by id", async () => {
      const { data, error } = await technicianClient
        .from("technician_jobs")
        .select(JOB_DETAIL_SELECT)
        .eq("id", fixtureIds.jobOwn)
        .maybeSingle();

      expect(error).toBeNull();
      expect((data as { id: string } | null)?.id).toBe(fixtureIds.jobOwn);
    });

    it("technician cannot read another technician's job detail by id", async () => {
      const { data, error } = await technicianClient
        .from("technician_jobs")
        .select(JOB_DETAIL_SELECT)
        .eq("id", fixtureIds.jobOther)
        .maybeSingle();

      expect(error).toBeNull();
      expect(data).toBeNull();
    });

    it("admin and operations_manager can read any job's detail", async () => {
      for (const client of [adminClient, opsClient]) {
        for (const id of [fixtureIds.jobOwn, fixtureIds.jobOther]) {
          const { data, error } = await client
            .from("technician_jobs")
            .select(JOB_DETAIL_SELECT)
            .eq("id", id)
            .maybeSingle();

          expect(error).toBeNull();
          expect(data).not.toBeNull();
        }
      }
    });

    it("job detail returns no pricing, revenue share or partner columns", async () => {
      const { data } = await opsClient
        .from("technician_jobs")
        .select(JOB_DETAIL_SELECT)
        .eq("id", fixtureIds.jobOwn)
        .single();

      const booking = (data as unknown as { booking: Record<string, unknown> })
        .booking;

      for (const column of [
        "daily_rate",
        "paid_days",
        "gross_revenue",
        "partner_share",
        "platform_share",
        "partner_id",
        "notes",
      ]) {
        expect(booking).not.toHaveProperty(column);
      }
      expect(booking).toHaveProperty("booking_number");
    });
  });

  // ===========================================================================
  // FO-F01-S04: creating a job is admin/operations_manager only; the insert
  // guard blocks a non-technician/inactive assignee and a duplicate open job.
  // ===========================================================================
  describe("job create access (FO-F01-S04)", () => {
    const createdJobIds: string[] = [];

    afterAll(async () => {
      if (createdJobIds.length > 0) {
        await service.from("technician_jobs").delete().in("id", createdJobIds);
      }
    });

    it("operations_manager can create a job and it defaults to assigned", async () => {
      const { data, error } = await opsClient
        .from("technician_jobs")
        .insert({
          booking_id: BOOKING_A_ID,
          technician_id: identities.technician.id,
          job_type: "cleaning",
        })
        .select("id, status, job_type")
        .single();

      expect(error).toBeNull();
      expect(data).toMatchObject({ status: "assigned", job_type: "cleaning" });
      createdJobIds.push(data!.id);
    });

    it("technician cannot create a job", async () => {
      const { data, error } = await technicianClient
        .from("technician_jobs")
        .insert({
          booking_id: BOOKING_A_ID,
          technician_id: identities.technician.id,
          job_type: "inspection",
        })
        .select("id");

      expect(error).not.toBeNull();
      expect(data).toBeNull();
    });

    it("partner_user cannot create a job on their own partner's booking", async () => {
      const { data, error } = await partnerAClient
        .from("technician_jobs")
        .insert({
          booking_id: BOOKING_A_ID,
          technician_id: identities.technician.id,
          job_type: "inspection",
        })
        .select("id");

      expect(error).not.toBeNull();
      expect(data).toBeNull();
    });

    it("insert is rejected when the assignee is not an active technician (JB001)", async () => {
      const { error } = await opsClient.from("technician_jobs").insert({
        booking_id: BOOKING_B_ID,
        technician_id: identities.inactive.id,
        job_type: "installation",
      });

      expect(error?.code).toBe("JB001");
    });

    it("insert is rejected when an open job of the same type exists (23505)", async () => {
      const { error } = await opsClient.from("technician_jobs").insert({
        booking_id: BOOKING_A_ID,
        technician_id: identities.technician.id,
        job_type: "installation",
      });

      expect(error?.code).toBe("23505");
    });
  });

  // ===========================================================================
  // FO-F01-S05: job status goes only through change_technician_job_status();
  // every status/assignee change is logged in the append-only
  // technician_job_events.
  // ===========================================================================
  describe("job status update (FO-F01-S05)", () => {
    const openedJobIds: string[] = [];

    async function createJob(
      technicianId: string,
      bookingId: string,
      jobType: "cleaning" | "inspection",
    ) {
      const { data, error } = await service
        .from("technician_jobs")
        .insert({
          booking_id: bookingId,
          technician_id: technicianId,
          job_type: jobType,
        })
        .select("id")
        .single();
      if (error) throw error;
      openedJobIds.push(data.id);
      return data.id;
    }

    const rpc = (
      client: SupabaseClient<Database>,
      jobId: string,
      from: "assigned" | "in_progress" | "completed" | "cancelled",
      to: "in_progress" | "completed" | "cancelled" | "assigned",
      reason?: string,
    ) =>
      client.rpc("change_technician_job_status", {
        p_job_id: jobId,
        p_from_status: from,
        p_to_status: to,
        p_reason: reason,
      });

    // Events are append-only, so test jobs are never deleted; move any job
    // left open to a terminal state so the open-job unique index does not
    // collide on the next run.
    afterEach(async () => {
      for (const id of openedJobIds.splice(0)) {
        const { data } = await service
          .from("technician_jobs")
          .select("status")
          .eq("id", id)
          .single();
        if (data && ["assigned", "in_progress"].includes(data.status)) {
          await rpc(opsClient, id, data.status, "cancelled", "test cleanup");
        }
      }
    });

    it("technician can start their own job and the start time and event are recorded", async () => {
      const jobId = await createJob(
        identities.technician.id,
        BOOKING_A_ID,
        "inspection",
      );

      const { data, error } = await rpc(
        technicianClient,
        jobId,
        "assigned",
        "in_progress",
      );

      expect(error).toBeNull();
      expect(data).toMatchObject({ status: "in_progress" });
      expect(data!.started_at).not.toBeNull();

      const { data: events } = await service
        .from("technician_job_events")
        .select("from_status, to_status, user_id")
        .eq("technician_job_id", jobId);
      expect(events).toEqual([
        {
          from_status: "assigned",
          to_status: "in_progress",
          user_id: identities.technician.id,
        },
      ]);
    });

    it("technician can complete their job in progress and completed is terminal", async () => {
      const jobId = await createJob(
        identities.technician.id,
        BOOKING_A_ID,
        "inspection",
      );
      await rpc(technicianClient, jobId, "assigned", "in_progress");

      const done = await rpc(technicianClient, jobId, "in_progress", "completed");
      expect(done.error).toBeNull();
      expect(done.data!.completed_at).not.toBeNull();

      const again = await rpc(technicianClient, jobId, "completed", "in_progress");
      expect(again.error?.code).toBe("55000");
    });

    it("rejects a transition that skips a step (assigned to completed)", async () => {
      const jobId = await createJob(
        identities.technician.id,
        BOOKING_A_ID,
        "inspection",
      );

      const { error } = await rpc(technicianClient, jobId, "assigned", "completed");

      expect(error?.code).toBe("55000");
    });

    it("rejects a change when the job moved on since it was loaded (JB004)", async () => {
      const jobId = await createJob(
        identities.technician.id,
        BOOKING_A_ID,
        "inspection",
      );
      await rpc(technicianClient, jobId, "assigned", "in_progress");

      const { error } = await rpc(technicianClient, jobId, "assigned", "in_progress");

      expect(error?.code).toBe("JB004");
    });

    it("technician cannot cancel a job; operations_manager can, with a reason", async () => {
      const jobId = await createJob(
        identities.technician.id,
        BOOKING_A_ID,
        "inspection",
      );

      const denied = await rpc(
        technicianClient,
        jobId,
        "assigned",
        "cancelled",
        "changed my mind",
      );
      expect(denied.error?.code).toBe("42501");

      const noReason = await rpc(opsClient, jobId, "assigned", "cancelled");
      expect(noReason.error?.code).toBe("22023");

      const ok = await rpc(
        opsClient,
        jobId,
        "assigned",
        "cancelled",
        "Booking changed",
      );
      expect(ok.error).toBeNull();

      const { data: events } = await service
        .from("technician_job_events")
        .select("to_status, notes")
        .eq("technician_job_id", jobId);
      expect(events).toEqual([{ to_status: "cancelled", notes: "Booking changed" }]);
    });

    it("rejects the second of two managers acting on the same job and keeps the first change (JB004)", async () => {
      const jobId = await createJob(
        identities.technician.id,
        BOOKING_A_ID,
        "inspection",
      );

      // Both managers loaded the job while it was "assigned".
      const first = await rpc(opsClient, jobId, "assigned", "in_progress");
      expect(first.error).toBeNull();

      const second = await rpc(adminClient, jobId, "assigned", "cancelled", "late");
      expect(second.error?.code).toBe("JB004");

      const { data } = await service
        .from("technician_jobs")
        .select("status")
        .eq("id", jobId)
        .single();
      expect(data!.status).toBe("in_progress");

      const { data: events } = await service
        .from("technician_job_events")
        .select("to_status")
        .eq("technician_job_id", jobId);
      expect(events).toEqual([{ to_status: "in_progress" }]);
    });

    it("allows the same user to retry with the status now shown after a conflict", async () => {
      const jobId = await createJob(
        identities.technician.id,
        BOOKING_A_ID,
        "inspection",
      );
      await rpc(opsClient, jobId, "assigned", "in_progress");

      const stale = await rpc(adminClient, jobId, "assigned", "cancelled", "late");
      expect(stale.error?.code).toBe("JB004");

      const retry = await rpc(adminClient, jobId, "in_progress", "cancelled", "late");
      expect(retry.error).toBeNull();
      expect(retry.data!.status).toBe("cancelled");
    });

    it("technician cannot change another technician's job (reported as not found)", async () => {
      const jobId = await createJob(
        OTHER_TECHNICIAN_ID,
        BOOKING_B_ID,
        "cleaning",
      );

      const { error } = await rpc(technicianClient, jobId, "assigned", "in_progress");

      expect(error?.code).toBe("P0002");
      const { data } = await service
        .from("technician_jobs")
        .select("status")
        .eq("id", jobId)
        .single();
      expect(data!.status).toBe("assigned");
    });

    it("partner_user cannot change a job status", async () => {
      const jobId = await createJob(
        identities.technician.id,
        BOOKING_A_ID,
        "inspection",
      );

      const { error } = await rpc(partnerAClient, jobId, "assigned", "in_progress");

      expect(error).not.toBeNull();
      const { data } = await service
        .from("technician_jobs")
        .select("status")
        .eq("id", jobId)
        .single();
      expect(data!.status).toBe("assigned");
    });

    it("blocks a direct update of status, booking and technician by the technician", async () => {
      const jobId = await createJob(
        identities.technician.id,
        BOOKING_A_ID,
        "inspection",
      );

      const status = await technicianClient
        .from("technician_jobs")
        .update({ status: "completed" })
        .eq("id", jobId);
      expect(status.error?.code).toBe("55000");

      const booking = await technicianClient
        .from("technician_jobs")
        .update({ booking_id: BOOKING_B_ID })
        .eq("id", jobId);
      expect(booking.error?.code).toBe("55000");

      const assignee = await technicianClient
        .from("technician_jobs")
        .update({ technician_id: OTHER_TECHNICIAN_ID })
        .eq("id", jobId);
      expect(assignee.error).not.toBeNull();
    });

    it("still lets the technician edit non-protected fields directly", async () => {
      const jobId = await createJob(
        identities.technician.id,
        BOOKING_A_ID,
        "inspection",
      );

      const { error } = await technicianClient
        .from("technician_jobs")
        .update({ installation_notes: "Seat fitted" })
        .eq("id", jobId);

      expect(error).toBeNull();
    });

    it("operations_manager can reassign to an active technician and the change is logged", async () => {
      const jobId = await createJob(
        identities.technician.id,
        BOOKING_A_ID,
        "inspection",
      );

      const { error } = await opsClient
        .from("technician_jobs")
        .update({ technician_id: OTHER_TECHNICIAN_ID })
        .eq("id", jobId);
      expect(error).toBeNull();

      const { data: events } = await service
        .from("technician_job_events")
        .select("from_technician_id, to_technician_id, from_status, to_status")
        .eq("technician_job_id", jobId);
      expect(events).toEqual([
        {
          from_technician_id: identities.technician.id,
          to_technician_id: OTHER_TECHNICIAN_ID,
          from_status: "assigned",
          to_status: "assigned",
        },
      ]);
    });

    it("rejects reassigning a job to a user who is not an active technician (JB001)", async () => {
      const jobId = await createJob(
        identities.technician.id,
        BOOKING_A_ID,
        "inspection",
      );

      const { error } = await opsClient
        .from("technician_jobs")
        .update({ technician_id: identities.inactive.id })
        .eq("id", jobId);

      expect(error?.code).toBe("JB001");
    });

    it("technician reads the history of their own job; zero rows for another technician's job, a partner_user or anonymous", async () => {
      const ownId = await createJob(
        identities.technician.id,
        BOOKING_A_ID,
        "inspection",
      );
      const otherId = await createJob(
        OTHER_TECHNICIAN_ID,
        BOOKING_B_ID,
        "cleaning",
      );
      await rpc(technicianClient, ownId, "assigned", "in_progress");
      await rpc(opsClient, otherId, "assigned", "in_progress");

      const own = await technicianClient
        .from("technician_job_events")
        .select("id")
        .eq("technician_job_id", ownId);
      expect(own.error).toBeNull();
      expect(own.data).toHaveLength(1);

      const other = await technicianClient
        .from("technician_job_events")
        .select("id")
        .eq("technician_job_id", otherId);
      expect(other.error).toBeNull();
      expect(other.data).toEqual([]);

      for (const client of [partnerAClient, partnerBClient, anonClient]) {
        const { data } = await client
          .from("technician_job_events")
          .select("id")
          .in("technician_job_id", [ownId, otherId]);
        expect(data ?? []).toEqual([]);
      }

      const ops = await opsClient
        .from("technician_job_events")
        .select("id")
        .in("technician_job_id", [ownId, otherId]);
      expect(ops.data).toHaveLength(2);
    });

    it("job events cannot be inserted, updated or deleted by any role", async () => {
      const jobId = await createJob(
        identities.technician.id,
        BOOKING_A_ID,
        "inspection",
      );
      await rpc(technicianClient, jobId, "assigned", "in_progress");
      const { data: event } = await service
        .from("technician_job_events")
        .select("id")
        .eq("technician_job_id", jobId)
        .single();

      for (const client of [opsClient, adminClient, technicianClient]) {
        const insert = await client.from("technician_job_events").insert({
          technician_job_id: jobId,
          to_status: "completed",
        });
        expect(insert.error).not.toBeNull();

        const update = await client
          .from("technician_job_events")
          .update({ notes: "tampered" })
          .eq("id", event!.id)
          .select("id");
        expect(update.data ?? []).toEqual([]);

        const del = await client
          .from("technician_job_events")
          .delete()
          .eq("id", event!.id)
          .select("id");
        expect(del.data ?? []).toEqual([]);
      }

      const direct = await service
        .from("technician_job_events")
        .update({ notes: "tampered" })
        .eq("id", event!.id);
      expect(direct.error?.code).toBe("55000");
    });
  });

  // ===========================================================================
  // FO-F01-S07: a technician who is unassigned while viewing a job loses
  // access at once: the next action is rejected and the job leaves the list.
  // ===========================================================================
  describe("job unassignment (FO-F01-S07)", () => {
    let jobId: string;

    beforeAll(async () => {
      const { data, error } = await service
        .from("technician_jobs")
        .insert({
          booking_id: BOOKING_A_ID,
          technician_id: identities.technician.id,
          job_type: "inspection",
        })
        .select("id")
        .single();
      if (error) throw error;
      jobId = data.id;
    });

    // Events are append-only, so the job is not deleted; close it so the
    // open-job unique index does not collide on the next run.
    afterAll(async () => {
      await opsClient.rpc("change_technician_job_status", {
        p_job_id: jobId,
        p_from_status: "assigned",
        p_to_status: "cancelled",
        p_reason: "test cleanup",
      });
    });

    it("technician sees the job in the list and detail while it is assigned to them", async () => {
      const list = await technicianClient
        .from("technician_jobs")
        .select("id")
        .eq("id", jobId);
      expect(list.data).toHaveLength(1);

      const detail = await technicianClient
        .from("technician_jobs")
        .select(JOB_DETAIL_SELECT)
        .eq("id", jobId)
        .maybeSingle();
      expect(detail.data).not.toBeNull();
    });

    it("rejects the next action, hides the job and its history once the job is unassigned", async () => {
      const reassign = await opsClient
        .from("technician_jobs")
        .update({ technician_id: OTHER_TECHNICIAN_ID })
        .eq("id", jobId);
      expect(reassign.error).toBeNull();

      // The status change is rejected as "not found" (no existence leak).
      const action = await technicianClient.rpc("change_technician_job_status", {
        p_job_id: jobId,
        p_from_status: "assigned",
        p_to_status: "in_progress",
      });
      expect(action.error?.code).toBe("P0002");

      // The job left the technician's list and detail.
      const list = await technicianClient
        .from("technician_jobs")
        .select("id")
        .eq("id", jobId);
      expect(list.error).toBeNull();
      expect(list.data).toEqual([]);

      const detail = await technicianClient
        .from("technician_jobs")
        .select(JOB_DETAIL_SELECT)
        .eq("id", jobId)
        .maybeSingle();
      expect(detail.data).toBeNull();

      // A direct edit changes nothing either.
      const edit = await technicianClient
        .from("technician_jobs")
        .update({ installation_notes: "still mine?" })
        .eq("id", jobId)
        .select("id");
      expect(edit.data ?? []).toEqual([]);

      const events = await technicianClient
        .from("technician_job_events")
        .select("id")
        .eq("technician_job_id", jobId);
      expect(events.data ?? []).toEqual([]);

      const { data: unchanged } = await service
        .from("technician_jobs")
        .select("status, installation_notes")
        .eq("id", jobId)
        .single();
      expect(unchanged).toEqual({ status: "assigned", installation_notes: null });
    });

    it("keeps the job with the technician it was reassigned to", async () => {
      const { data } = await service
        .from("technician_jobs")
        .select("technician_id")
        .eq("id", jobId)
        .single();

      expect(data!.technician_id).toBe(OTHER_TECHNICIAN_ID);
    });
  });

  // ===========================================================================
  // FO-F02-S01: recording an installation. RLS limits who may insert; the
  // guard trigger validates the job and seat and sets seat_id/created_by.
  // ===========================================================================
  describe("record installation (FO-F02-S01)", () => {
    // Bookings without an open installation job in the shared fixtures:
    // 4 is partner A's (seat 4), 3 is partner B's (seat 3).
    const BOOKING_C_ID = "f0000000-0000-0000-0000-000000000004";
    const SEAT_C_ID = "e0000000-0000-0000-0000-000000000004";
    const BOOKING_D_ID = "f0000000-0000-0000-0000-000000000003";
    const installedAt = () => new Date(Date.now() - 60_000).toISOString();

    async function createInstallationJob(
      technicianId: string,
      bookingId: string,
      jobType: "installation" | "cleaning" = "installation",
      status: "assigned" | "completed" = "assigned",
    ) {
      const { data, error } = await service
        .from("technician_jobs")
        .insert({
          booking_id: bookingId,
          technician_id: technicianId,
          job_type: jobType,
          status,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    }

    // No status change is made through the RPC, so these jobs have no events
    // and can be removed; a leftover job would also make the booking's seat
    // visible to the technician in other suites.
    const createdJobIds: string[] = [];
    const track = (id: string) => {
      createdJobIds.push(id);
      return id;
    };

    afterEach(async () => {
      for (const id of createdJobIds.splice(0)) {
        await service.from("installations").delete().eq("technician_job_id", id);
        await service.from("technician_jobs").delete().eq("id", id);
      }
    });

    it("technician records an installation on their job and the server sets seat and author", async () => {
      const jobId = track(
        await createInstallationJob(identities.technician.id, BOOKING_C_ID),
      );

      const { data, error } = await technicianClient
        .from("installations")
        .insert({
          technician_job_id: jobId,
          completed_at: installedAt(),
          notes: "Fitted",
          installation_completed: true,
          // Forged values must be overwritten by the guard trigger.
          created_by: OTHER_TECHNICIAN_ID,
          seat_id: SEAT_A_ID,
        })
        .select("seat_id, created_by, installation_completed")
        .single();

      expect(error).toBeNull();
      expect(data).toEqual({
        seat_id: SEAT_C_ID,
        created_by: identities.technician.id,
        installation_completed: true,
      });
    });

    it("rejects a second installation for the same job (23505)", async () => {
      const jobId = track(
        await createInstallationJob(identities.technician.id, BOOKING_C_ID),
      );
      const first = await technicianClient
        .from("installations")
        .insert({ technician_job_id: jobId, completed_at: installedAt() });
      expect(first.error).toBeNull();

      const second = await technicianClient
        .from("installations")
        .insert({ technician_job_id: jobId, completed_at: installedAt() });

      expect(second.error?.code).toBe("23505");
    });

    it("technician cannot record an installation on another technician's job", async () => {
      const jobId = track(
        await createInstallationJob(OTHER_TECHNICIAN_ID, BOOKING_D_ID),
      );

      const { error } = await technicianClient
        .from("installations")
        .insert({ technician_job_id: jobId, completed_at: installedAt() });

      expect(error).not.toBeNull();
      const { data } = await service
        .from("installations")
        .select("id")
        .eq("technician_job_id", jobId);
      expect(data).toEqual([]);
    });

    it.each([
      ["admin", () => adminClient],
      ["ops", () => opsClient],
    ])(
      "%s can record an installation on a job assigned to a technician",
      async (_role, getClient) => {
        const jobId = track(
          await createInstallationJob(identities.technician.id, BOOKING_C_ID),
        );

        const { data, error } = await getClient()
          .from("installations")
          .insert({
            technician_job_id: jobId,
            completed_at: installedAt(),
            installation_completed: true,
          })
          .select("technician_job_id")
          .single();

        expect(error).toBeNull();
        expect(data?.technician_job_id).toBe(jobId);
      },
    );

    it("rejects the next recording once the technician loses the assignment, and leaves no row", async () => {
      // Not tracked: the reassignment writes a job event, so the job cannot be
      // deleted afterwards. It is cancelled instead, which frees the booking.
      const jobId = await createInstallationJob(
        identities.technician.id,
        BOOKING_C_ID,
      );

      try {
        const reassign = await opsClient
          .from("technician_jobs")
          .update({ technician_id: OTHER_TECHNICIAN_ID })
          .eq("id", jobId);
        expect(reassign.error).toBeNull();

        const { error } = await technicianClient
          .from("installations")
          .insert({ technician_job_id: jobId, completed_at: installedAt() });

        expect(error).not.toBeNull();
        const { data } = await service
          .from("installations")
          .select("id")
          .eq("technician_job_id", jobId);
        expect(data).toEqual([]);
      } finally {
        await opsClient.rpc("change_technician_job_status", {
          p_job_id: jobId,
          p_from_status: "assigned",
          p_to_status: "cancelled",
          p_reason: "installation test cleanup",
        });
      }
    });

    it("partner_user cannot record an installation, even on their own partner's booking", async () => {
      const jobId = track(
        await createInstallationJob(identities.technician.id, BOOKING_C_ID),
      );

      const { error } = await partnerAClient
        .from("installations")
        .insert({ technician_job_id: jobId, completed_at: installedAt() });

      expect(error).not.toBeNull();
    });

    it("rejects an installation on a job that is not an installation job (JB005)", async () => {
      const jobId = track(
        await createInstallationJob(
          identities.technician.id,
          BOOKING_C_ID,
          "cleaning",
        ),
      );

      const { error } = await technicianClient
        .from("installations")
        .insert({ technician_job_id: jobId, completed_at: installedAt() });

      expect(error?.code).toBe("JB005");
    });

    it("rejects an installation on a job that is no longer active (JB006)", async () => {
      const jobId = track(
        await createInstallationJob(
          identities.technician.id,
          BOOKING_C_ID,
          "installation",
          "completed",
        ),
      );

      const { error } = await technicianClient
        .from("installations")
        .insert({ technician_job_id: jobId, completed_at: installedAt() });

      expect(error?.code).toBe("JB006");
    });

    it("rejects an installation when the seat is in a status that does not allow it (JB007)", async () => {
      const jobId = track(
        await createInstallationJob(identities.technician.id, BOOKING_C_ID),
      );
      const quarantine = await adminClient.rpc("change_seat_status", {
        p_seat_id: SEAT_C_ID,
        p_to_status: "quarantine",
        p_reason: "installation test",
      });
      expect(quarantine.error).toBeNull();

      const { error } = await technicianClient
        .from("installations")
        .insert({ technician_job_id: jobId, completed_at: installedAt() });

      await adminClient.rpc("change_seat_status", {
        p_seat_id: SEAT_C_ID,
        p_to_status: "available",
        p_reason: "installation test",
      });
      expect(error?.code).toBe("JB007");
    });

    async function seatSnapshot(seatId: string) {
      const seat = await service
        .from("seats")
        .select("status")
        .eq("id", seatId)
        .single();
      const history = await service
        .from("seat_status_history")
        .select("id", { count: "exact", head: true })
        .eq("seat_id", seatId);
      return { status: seat.data!.status, historyCount: history.count };
    }

    it("leaves the seat status and its history unchanged when an installation is recorded", async () => {
      const jobId = track(
        await createInstallationJob(identities.technician.id, BOOKING_C_ID),
      );
      const before = await seatSnapshot(SEAT_C_ID);

      const { error } = await technicianClient
        .from("installations")
        .insert({ technician_job_id: jobId, completed_at: installedAt() });

      expect(error).toBeNull();
      expect(await seatSnapshot(SEAT_C_ID)).toEqual(before);
    });

    it("leaves the seat status and its history unchanged when the seat does not allow installation (JB007)", async () => {
      const jobId = track(
        await createInstallationJob(identities.technician.id, BOOKING_C_ID),
      );
      const quarantine = await adminClient.rpc("change_seat_status", {
        p_seat_id: SEAT_C_ID,
        p_to_status: "quarantine",
        p_reason: "installation test",
      });
      expect(quarantine.error).toBeNull();
      const before = await seatSnapshot(SEAT_C_ID);

      const { error } = await technicianClient
        .from("installations")
        .insert({ technician_job_id: jobId, completed_at: installedAt() });
      const after = await seatSnapshot(SEAT_C_ID);

      await adminClient.rpc("change_seat_status", {
        p_seat_id: SEAT_C_ID,
        p_to_status: "available",
        p_reason: "installation test",
      });
      expect(error?.code).toBe("JB007");
      expect(after).toEqual(before);
      expect(before.status).toBe("quarantine");
    });

    it("rejects an installation time in the future (22023)", async () => {
      const jobId = track(
        await createInstallationJob(identities.technician.id, BOOKING_C_ID),
      );

      const { error } = await technicianClient.from("installations").insert({
        technician_job_id: jobId,
        completed_at: new Date(Date.now() + 3_600_000).toISOString(),
      });

      expect(error?.code).toBe("22023");
    });

    it("lets exactly one of two simultaneous recordings through and keeps a single row (23505)", async () => {
      const jobId = track(
        await createInstallationJob(identities.technician.id, BOOKING_C_ID),
      );

      const [byTechnician, byOps] = await Promise.all([
        technicianClient
          .from("installations")
          .insert({ technician_job_id: jobId, completed_at: installedAt() }),
        opsClient
          .from("installations")
          .insert({ technician_job_id: jobId, completed_at: installedAt() }),
      ]);

      const errors = [byTechnician.error, byOps.error];
      expect(errors.filter((e) => e === null)).toHaveLength(1);
      expect(errors.find((e) => e !== null)?.code).toBe("23505");
      const { data } = await service
        .from("installations")
        .select("id")
        .eq("technician_job_id", jobId);
      expect(data).toHaveLength(1);
    });

    it("keeps the first record unchanged when a second recording is rejected", async () => {
      const jobId = track(
        await createInstallationJob(identities.technician.id, BOOKING_C_ID),
      );
      const first = await technicianClient
        .from("installations")
        .insert({
          technician_job_id: jobId,
          completed_at: installedAt(),
          notes: "first",
        })
        .select("id")
        .single();

      const second = await opsClient.from("installations").insert({
        technician_job_id: jobId,
        completed_at: installedAt(),
        notes: "second",
      });

      expect(second.error?.code).toBe("23505");
      const { data } = await service
        .from("installations")
        .select("id, notes")
        .eq("technician_job_id", jobId);
      expect(data).toEqual([{ id: first.data!.id, notes: "first" }]);
    });

    it("keeps a recorded installation: it is readable by the technician and ops and cannot be changed or removed", async () => {
      const jobId = track(
        await createInstallationJob(identities.technician.id, BOOKING_C_ID),
      );
      const created = await technicianClient
        .from("installations")
        .insert({ technician_job_id: jobId, completed_at: installedAt() })
        .select("id")
        .single();
      const installationId = created.data!.id;

      for (const client of [technicianClient, opsClient]) {
        const { data } = await client
          .from("installations")
          .select("id")
          .eq("id", installationId);
        expect(data).toHaveLength(1);
      }

      // UPDATE and DELETE privileges are revoked: the database refuses the
      // statement outright instead of silently matching zero rows.
      for (const client of [
        technicianClient,
        opsClient,
        adminClient,
        partnerAClient,
      ]) {
        const update = await client
          .from("installations")
          .update({ notes: "tampered" })
          .eq("id", installationId);
        expect(update.error?.code).toBe("42501");

        const del = await client
          .from("installations")
          .delete()
          .eq("id", installationId);
        expect(del.error?.code).toBe("42501");
      }

      const { data: row } = await service
        .from("installations")
        .select("notes")
        .eq("id", installationId)
        .single();
      expect(row!.notes).toBeNull();
    });
  });

  // ===========================================================================
  // FO-F03-S01: recording a cleaning. RLS limits who may insert (the assigned
  // technician, admin/ops); the guard trigger validates the job and seat and
  // sets seat_id, booking_id, employee_id and started_at.
  // ===========================================================================
  describe("record cleaning (FO-F03-S01)", () => {
    // Bookings without an open cleaning job in the shared fixtures: 4 is
    // partner A's (seat 4), 3 is partner B's (seat 3).
    const BOOKING_C_ID = "f0000000-0000-0000-0000-000000000004";
    const SEAT_C_ID = "e0000000-0000-0000-0000-000000000004";
    const BOOKING_D_ID = "f0000000-0000-0000-0000-000000000003";
    const cleanedAt = () => new Date(Date.now() - 60_000).toISOString();

    // The generated insert type requires these NOT NULL columns; the guard
    // trigger overwrites seat_id, booking_id, employee_id and started_at.
    const cleaningRow = (
      jobId: string,
      extra: Partial<
        Database["public"]["Tables"]["cleaning_records"]["Insert"]
      > = {},
    ) => ({
      technician_job_id: jobId,
      seat_id: SEAT_C_ID,
      employee_id: identities.technician.id,
      started_at: cleanedAt(),
      completed_at: cleanedAt(),
      ...extra,
    });

    async function createCleaningJob(
      technicianId: string,
      bookingId: string,
      jobType: "cleaning" | "installation" = "cleaning",
      status: "assigned" | "completed" = "assigned",
    ) {
      const { data, error } = await service
        .from("technician_jobs")
        .insert({
          booking_id: bookingId,
          technician_id: technicianId,
          job_type: jobType,
          status,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    }

    // No status change is made through the RPC, so these jobs have no events
    // and can be removed.
    const createdJobIds: string[] = [];
    const track = (id: string) => {
      createdJobIds.push(id);
      return id;
    };

    afterEach(async () => {
      for (const id of createdJobIds.splice(0)) {
        await service
          .from("cleaning_records")
          .delete()
          .eq("technician_job_id", id);
        await service.from("technician_jobs").delete().eq("id", id);
      }
    });

    it("technician records a cleaning on their job and the server sets seat, booking, employee and start", async () => {
      const jobId = track(
        await createCleaningJob(identities.technician.id, BOOKING_C_ID),
      );

      const { data, error } = await technicianClient
        .from("cleaning_records")
        .insert(
          cleaningRow(jobId, {
            notes: "Wiped and checked",
            // Forged values must be overwritten by the guard trigger.
            seat_id: SEAT_A_ID,
            booking_id: BOOKING_A_ID,
            started_at: "2001-01-01T00:00:00Z",
          }),
        )
        .select("seat_id, booking_id, employee_id, started_at, completed_at")
        .single();

      expect(error).toBeNull();
      expect(data).toMatchObject({
        seat_id: SEAT_C_ID,
        booking_id: BOOKING_C_ID,
        employee_id: identities.technician.id,
      });
      expect(new Date(data!.started_at).getTime()).toBe(
        new Date(data!.completed_at!).getTime(),
      );
    });

    it.each([
      ["admin", () => adminClient, () => identities.admin.id],
      ["ops", () => opsClient, () => identities.opsManager.id],
    ])(
      "%s can record a cleaning on a job assigned to a technician, as the employee",
      async (_role, getClient, getUserId) => {
        const jobId = track(
          await createCleaningJob(identities.technician.id, BOOKING_C_ID),
        );

        const { data, error } = await getClient()
          .from("cleaning_records")
          .insert(cleaningRow(jobId, { employee_id: getUserId() }))
          .select("employee_id")
          .single();

        expect(error).toBeNull();
        expect(data?.employee_id).toBe(getUserId());
      },
    );

    it("technician cannot record a cleaning on another technician's job", async () => {
      const jobId = track(
        await createCleaningJob(OTHER_TECHNICIAN_ID, BOOKING_D_ID),
      );

      const { error } = await technicianClient.from("cleaning_records").insert(cleaningRow(jobId));

      expect(error).not.toBeNull();
      const { data } = await service
        .from("cleaning_records")
        .select("id")
        .eq("technician_job_id", jobId);
      expect(data).toEqual([]);
    });

    it("rejects the next cleaning once the technician loses the assignment, and leaves no row", async () => {
      // Not tracked: the reassignment writes a job event, so the job cannot be
      // deleted afterwards. It is cancelled instead, which frees the booking.
      const jobId = await createCleaningJob(
        identities.technician.id,
        BOOKING_C_ID,
      );

      try {
        const reassign = await opsClient
          .from("technician_jobs")
          .update({ technician_id: OTHER_TECHNICIAN_ID })
          .eq("id", jobId);
        expect(reassign.error).toBeNull();

        const { error } = await technicianClient
          .from("cleaning_records")
          .insert(cleaningRow(jobId));

        expect(error).not.toBeNull();
        const { data } = await service
          .from("cleaning_records")
          .select("id")
          .eq("technician_job_id", jobId);
        expect(data).toEqual([]);
      } finally {
        await opsClient.rpc("change_technician_job_status", {
          p_job_id: jobId,
          p_from_status: "assigned",
          p_to_status: "cancelled",
          p_reason: "cleaning test cleanup",
        });
      }
    });

    it("technician cannot record a cleaning without a job", async () => {
      const { error } = await technicianClient.from("cleaning_records").insert({
        seat_id: SEAT_C_ID,
        booking_id: BOOKING_C_ID,
        employee_id: identities.technician.id,
        started_at: cleanedAt(),
        completed_at: cleanedAt(),
      });

      expect(error).not.toBeNull();
    });

    it("partner_user cannot record a cleaning, even on their own partner's booking", async () => {
      const jobId = track(
        await createCleaningJob(identities.technician.id, BOOKING_C_ID),
      );

      const { error } = await partnerAClient.from("cleaning_records").insert(
        cleaningRow(jobId, { employee_id: identities.partnerA.id }),
      );

      expect(error).not.toBeNull();
    });

    it("rejects a second cleaning for the same job (23505)", async () => {
      const jobId = track(
        await createCleaningJob(identities.technician.id, BOOKING_C_ID),
      );
      const first = await technicianClient
        .from("cleaning_records")
        .insert(cleaningRow(jobId));
      expect(first.error).toBeNull();

      const second = await technicianClient
        .from("cleaning_records")
        .insert(cleaningRow(jobId));

      expect(second.error?.code).toBe("23505");
    });

    it("rejects a cleaning on a job that is not a cleaning job (JB005)", async () => {
      const jobId = track(
        await createCleaningJob(
          identities.technician.id,
          BOOKING_C_ID,
          "installation",
        ),
      );

      const { error } = await technicianClient
        .from("cleaning_records")
        .insert(cleaningRow(jobId));

      expect(error?.code).toBe("JB005");
    });

    it("rejects a cleaning on a job that is no longer active (JB006)", async () => {
      const jobId = track(
        await createCleaningJob(
          identities.technician.id,
          BOOKING_C_ID,
          "cleaning",
          "completed",
        ),
      );

      const { error } = await technicianClient
        .from("cleaning_records")
        .insert(cleaningRow(jobId));

      expect(error?.code).toBe("JB006");
    });

    it("rejects a cleaning time in the future (22023)", async () => {
      const jobId = track(
        await createCleaningJob(identities.technician.id, BOOKING_C_ID),
      );

      const { error } = await technicianClient.from("cleaning_records").insert(
        cleaningRow(jobId, {
          completed_at: new Date(Date.now() + 3_600_000).toISOString(),
        }),
      );

      expect(error?.code).toBe("22023");
    });

    it("rejects a cleaning without a time (22023)", async () => {
      const jobId = track(
        await createCleaningJob(identities.technician.id, BOOKING_C_ID),
      );

      const { error } = await technicianClient
        .from("cleaning_records")
        .insert(cleaningRow(jobId, { completed_at: null }));

      expect(error?.code).toBe("22023");
    });

    it("keeps a recorded cleaning: it cannot be changed or removed by the technician, ops or admin", async () => {
      const jobId = track(
        await createCleaningJob(identities.technician.id, BOOKING_C_ID),
      );
      const created = await technicianClient
        .from("cleaning_records")
        .insert(cleaningRow(jobId))
        .select("id")
        .single();
      const cleaningId = created.data!.id;

      for (const client of [technicianClient, opsClient, adminClient]) {
        const update = await client
          .from("cleaning_records")
          .update({ notes: "tampered" })
          .eq("id", cleaningId)
          .select("id");
        expect(update.data ?? []).toEqual([]);

        const del = await client
          .from("cleaning_records")
          .delete()
          .eq("id", cleaningId)
          .select("id");
        expect(del.data ?? []).toEqual([]);
      }

      const { data: row } = await service
        .from("cleaning_records")
        .select("notes")
        .eq("id", cleaningId)
        .single();
      expect(row!.notes).toBeNull();
    });
  });

  // ===========================================================================
  // FO-F01-S01: technician list reads `users` with role = 'technician'
  // ===========================================================================
  describe("technician list access (FO-F01-S01)", () => {
    it("admin and operations_manager can list technician users", async () => {
      for (const client of [adminClient, opsClient]) {
        const { data, error } = await client
          .from("users")
          .select("id")
          .eq("role", "technician");

        expect(error).toBeNull();
        expect(data!.map((u) => u.id)).toContain(identities.technician.id);
      }
    });

    it("technician listing technician users sees only themselves", async () => {
      const { data, error } = await technicianClient
        .from("users")
        .select("id")
        .eq("role", "technician");

      expect(error).toBeNull();
      expect(data).toEqual([{ id: identities.technician.id }]);
    });

    it("partner_user listing technician users sees none", async () => {
      for (const client of [partnerAClient, partnerNullClient]) {
        const { data, error } = await client
          .from("users")
          .select("id")
          .eq("role", "technician");

        expect(error).toBeNull();
        expect(data).toEqual([]);
      }
    });

    it("anonymous client listing technician users sees none", async () => {
      const { data } = await anonClient
        .from("users")
        .select("id")
        .eq("role", "technician");

      expect(data ?? []).toEqual([]);
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

  // ===========================================================================
  // 9. partners table (F06 — Partner Management's app layer sits entirely on
  // top of this pre-existing F05 RLS coverage; F06 added no new migration/
  // policy, see plan.md Task 1/19).
  // ===========================================================================
  describe("partners table", () => {
    it("admin can SELECT both seeded partners", async () => {
      const { data, error } = await adminClient
        .from("partners")
        .select("id")
        .in("id", [PARTNER_A_ID, PARTNER_B_ID]);
      expect(error).toBeNull();
      expect(data?.map((p) => p.id).sort()).toEqual(
        [PARTNER_A_ID, PARTNER_B_ID].sort(),
      );
    });

    it("operations_manager can SELECT both seeded partners", async () => {
      const { data, error } = await opsClient
        .from("partners")
        .select("id")
        .in("id", [PARTNER_A_ID, PARTNER_B_ID]);
      expect(error).toBeNull();
      expect(data?.map((p) => p.id).sort()).toEqual(
        [PARTNER_A_ID, PARTNER_B_ID].sort(),
      );
    });

    it("partner_user (partner A) sees only their own partner row; zero rows for partner B's (not an error)", async () => {
      const { data: own, error: ownError } = await partnerAClient
        .from("partners")
        .select("id")
        .eq("id", PARTNER_A_ID);
      expect(ownError).toBeNull();
      expect(own).toHaveLength(1);

      const { data: other, error: otherError } = await partnerAClient
        .from("partners")
        .select("id")
        .eq("id", PARTNER_B_ID);
      expect(otherError).toBeNull();
      expect(other).toEqual([]);
    });

    it("technician gets zero rows on partners (no policy grants technician access)", async () => {
      const { data, error } = await technicianClient
        .from("partners")
        .select("id");
      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it("partner_user (partner A) is rejected on INSERT into partners", async () => {
      const { error } = await partnerAClient.from("partners").insert({
        name: "Attacker Rent A Car",
        code: `RLS-TEST-DENIED-${Date.now()}`,
        contact_email: "attacker@example.com",
      });
      expect(error).not.toBeNull();
    });

    it("partner_user (partner A) is rejected on UPDATE of their own partner row (matches zero rows, not an error)", async () => {
      const { data, error } = await partnerAClient
        .from("partners")
        .update({ name: "Hacked By Partner A" })
        .eq("id", PARTNER_A_ID)
        .select();
      expect(error).toBeNull();
      expect(data).toEqual([]);

      const { data: check } = await service
        .from("partners")
        .select("name")
        .eq("id", PARTNER_A_ID)
        .single();
      expect(check?.name).not.toBe("Hacked By Partner A");
    });

    it("operations_manager can INSERT and UPDATE a partner", async () => {
      const code = `RLS-TEST-OPS-${Date.now()}`;
      const { data: inserted, error: insertError } = await opsClient
        .from("partners")
        .insert({
          name: "RLS Test Ops Partner",
          code,
          contact_email: "ops-test@example.com",
        })
        .select("id")
        .single();
      expect(insertError).toBeNull();
      expect(inserted?.id).toBeDefined();

      const { error: updateError } = await opsClient
        .from("partners")
        .update({ status: "active" })
        .eq("id", inserted!.id);
      expect(updateError).toBeNull();

      if (inserted) {
        await service.from("partners").delete().eq("id", inserted.id);
      }
    });

    it("a deactivated partner (status = 'inactive') remains readable by admin/operations_manager - no hard delete, no hidden row", async () => {
      const code = `RLS-TEST-DEACTIVATE-${Date.now()}`;
      const { data: inserted, error: insertError } = await opsClient
        .from("partners")
        .insert({
          name: "RLS Test Deactivation Partner",
          code,
          contact_email: "deactivate-test@example.com",
        })
        .select("id")
        .single();
      expect(insertError).toBeNull();
      expect(inserted?.id).toBeDefined();

      // Mirrors deactivate-partner.action.ts's conditional UPDATE - a
      // soft status change, never a DELETE.
      const { error: deactivateError } = await opsClient
        .from("partners")
        .update({ status: "inactive" })
        .eq("id", inserted!.id)
        .neq("status", "inactive");
      expect(deactivateError).toBeNull();

      const { data: afterAdmin, error: afterAdminError } = await adminClient
        .from("partners")
        .select("id, name, code, contact_email, status")
        .eq("id", inserted!.id)
        .maybeSingle();
      expect(afterAdminError).toBeNull();
      expect(afterAdmin).toMatchObject({
        id: inserted!.id,
        name: "RLS Test Deactivation Partner",
        code,
        contact_email: "deactivate-test@example.com",
        status: "inactive",
      });

      const { data: afterOps, error: afterOpsError } = await opsClient
        .from("partners")
        .select("id, status")
        .eq("id", inserted!.id)
        .maybeSingle();
      expect(afterOpsError).toBeNull();
      expect(afterOps).toMatchObject({ id: inserted!.id, status: "inactive" });

      if (inserted) {
        await service.from("partners").delete().eq("id", inserted.id);
      }
    });
  });

  // ===========================================================================
  // 10. airports table (F07 — Airport Management's app layer sits entirely on
  // top of this pre-existing F05 RLS coverage; F07 added no new migration/
  // policy, see plan.md's "F07 — Airport Management" plan, "Quyết định đã
  // chốt". Unlike `partners`, `airports` is shared reference data: policy
  // `airports_select_authenticated` uses `using (true)` so every
  // authenticated role (including `technician`/`partner_user`) can SELECT,
  // while `airports_insert_admin_ops_manager`/`airports_update_admin_ops_manager`
  // restrict writes to admin/operations_manager. No `DELETE` policy exists
  // for any role on this table.
  // ===========================================================================
  describe("airports table", () => {
    const SEEDED_AIRPORT_ID = "a0000000-0000-0000-0000-000000000001"; // DXB

    it("admin can SELECT the seeded airport", async () => {
      const { data, error } = await adminClient
        .from("airports")
        .select("id, code")
        .eq("id", SEEDED_AIRPORT_ID);
      expect(error).toBeNull();
      expect(data).toEqual([{ id: SEEDED_AIRPORT_ID, code: "DXB" }]);
    });

    it("operations_manager can SELECT the seeded airport", async () => {
      const { data, error } = await opsClient
        .from("airports")
        .select("id, code")
        .eq("id", SEEDED_AIRPORT_ID);
      expect(error).toBeNull();
      expect(data).toEqual([{ id: SEEDED_AIRPORT_ID, code: "DXB" }]);
    });

    it("technician can SELECT the seeded airport (using (true) grants read to every authenticated role)", async () => {
      const { data, error } = await technicianClient
        .from("airports")
        .select("id, code")
        .eq("id", SEEDED_AIRPORT_ID);
      expect(error).toBeNull();
      expect(data).toEqual([{ id: SEEDED_AIRPORT_ID, code: "DXB" }]);
    });

    it("partner_user can SELECT the seeded airport (using (true) grants read to every authenticated role)", async () => {
      const { data, error } = await partnerAClient
        .from("airports")
        .select("id, code")
        .eq("id", SEEDED_AIRPORT_ID);
      expect(error).toBeNull();
      expect(data).toEqual([{ id: SEEDED_AIRPORT_ID, code: "DXB" }]);
    });

    it("technician is rejected (matches zero rows, not an error) on INSERT into airports", async () => {
      const { data, error } = await technicianClient
        .from("airports")
        .insert({
          code: `RLS-TEST-DENIED-${Date.now()}`.slice(0, 10),
          name: "Attacker Airport",
          city: "Nowhere",
          country: "Nowhere",
          timezone: "UTC",
        })
        .select();
      expect(error).not.toBeNull();
      expect(data).toBeFalsy();
    });

    it("partner_user is rejected on INSERT into airports", async () => {
      const { error } = await partnerAClient.from("airports").insert({
        code: `RLSTSTB${Date.now()}`.slice(0, 10),
        name: "Attacker Airport",
        city: "Nowhere",
        country: "Nowhere",
        timezone: "UTC",
      });
      expect(error).not.toBeNull();
    });

    it("technician is rejected (matches zero rows, not an error) on UPDATE of the seeded airport", async () => {
      const { data, error } = await technicianClient
        .from("airports")
        .update({ name: "Hacked By Technician" })
        .eq("id", SEEDED_AIRPORT_ID)
        .select();
      expect(error).toBeNull();
      expect(data).toEqual([]);

      const { data: check } = await service
        .from("airports")
        .select("name")
        .eq("id", SEEDED_AIRPORT_ID)
        .single();
      expect(check?.name).not.toBe("Hacked By Technician");
    });

    it("partner_user is rejected (matches zero rows, not an error) on UPDATE of the seeded airport", async () => {
      const { data, error } = await partnerAClient
        .from("airports")
        .update({ name: "Hacked By Partner A" })
        .eq("id", SEEDED_AIRPORT_ID)
        .select();
      expect(error).toBeNull();
      expect(data).toEqual([]);

      const { data: check } = await service
        .from("airports")
        .select("name")
        .eq("id", SEEDED_AIRPORT_ID)
        .single();
      expect(check?.name).not.toBe("Hacked By Partner A");
    });

    it("operations_manager can INSERT and UPDATE an airport", async () => {
      const code = `RLSOPS${Date.now()}`.slice(0, 10);
      const { data: inserted, error: insertError } = await opsClient
        .from("airports")
        .insert({
          code,
          name: "RLS Test Ops Airport",
          city: "Test City",
          country: "Test Country",
          timezone: "UTC",
        })
        .select("id")
        .single();
      expect(insertError).toBeNull();
      expect(inserted?.id).toBeDefined();

      const { error: updateError } = await opsClient
        .from("airports")
        .update({ city: "Updated Test City" })
        .eq("id", inserted!.id);
      expect(updateError).toBeNull();

      if (inserted) {
        await service.from("airports").delete().eq("id", inserted.id);
      }
    });

    it("admin can INSERT an airport (unlike operations_manager-only tables elsewhere, both roles are allowed here)", async () => {
      const code = `RLSADM${Date.now()}`.slice(0, 10);
      const { data, error } = await adminClient
        .from("airports")
        .insert({
          code,
          name: "RLS Test Admin Airport",
          city: "Test City",
          country: "Test Country",
          timezone: "UTC",
        })
        .select("id")
        .single();
      expect(error).toBeNull();
      expect(data?.id).toBeDefined();

      if (data) {
        await service.from("airports").delete().eq("id", data.id);
      }
    });

    it("a duplicate code is rejected by the DB's unique constraint (23505), proving RLS-adjacent uniqueness still holds after F07", async () => {
      const { error } = await opsClient.from("airports").insert({
        code: "DXB",
        name: "Duplicate DXB Attempt",
        city: "Dubai",
        country: "United Arab Emirates",
        timezone: "Asia/Dubai",
      });
      expect(error).not.toBeNull();
      expect(error?.code).toBe("23505");
    });

    it("no role has a DELETE policy on airports (technician's delete matches zero rows, not an error, and the seeded row survives)", async () => {
      // No DELETE policy exists for `airports` -> RLS's default USING(false)
      // filters every row out of scope silently (same "matches zero rows,
      // not an error" outcome as an UPDATE with no matching policy
      // elsewhere in this suite), rather than surfacing a hard error.
      const { data, error } = await technicianClient
        .from("airports")
        .delete()
        .eq("id", SEEDED_AIRPORT_ID)
        .select();
      expect(error).toBeNull();
      expect(data).toEqual([]);

      const { data: check } = await service
        .from("airports")
        .select("id")
        .eq("id", SEEDED_AIRPORT_ID)
        .maybeSingle();
      expect(check?.id).toBe(SEEDED_AIRPORT_ID);
    });

    it("no role has a DELETE policy on airports (admin's delete also matches zero rows - no DELETE policy exists for any role, admin included)", async () => {
      const { data, error } = await adminClient
        .from("airports")
        .delete()
        .eq("id", SEEDED_AIRPORT_ID)
        .select();
      expect(error).toBeNull();
      expect(data).toEqual([]);

      const { data: check } = await service
        .from("airports")
        .select("id")
        .eq("id", SEEDED_AIRPORT_ID)
        .maybeSingle();
      expect(check?.id).toBe(SEEDED_AIRPORT_ID);
    });
  });
  // ===========================================================================
  // F08: seat_categories table. No migration was added for F08 - these tests
  // prove the F05 policies still hold for the new admin UI: shared reference
  // data (`using (true)` SELECT for every authenticated role), writes
  // restricted to admin/operations_manager, and no DELETE policy for anyone.
  // ===========================================================================
  describe("seat_categories table", () => {
    const SEEDED_CATEGORY_ID = "c0000000-0000-0000-0000-000000000001"; // Infant Carrier
    const createdCategoryIds: string[] = [];

    const newCategory = (label: string) => ({
      name: `RLS Test ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      description: "F08 RLS test fixture",
      min_child_age: 0,
      max_child_age: 12,
      safety_standard: "UN R129 (i-Size)",
    });

    afterAll(async () => {
      if (createdCategoryIds.length > 0) {
        await service
          .from("seat_categories")
          .delete()
          .in("id", createdCategoryIds);
      }
    });

    it("admin can SELECT the seeded seat category", async () => {
      const { data, error } = await adminClient
        .from("seat_categories")
        .select("id, name")
        .eq("id", SEEDED_CATEGORY_ID);
      expect(error).toBeNull();
      expect(data).toEqual([{ id: SEEDED_CATEGORY_ID, name: "Infant Carrier" }]);
    });

    it("operations_manager can SELECT the seeded seat category", async () => {
      const { data, error } = await opsClient
        .from("seat_categories")
        .select("id")
        .eq("id", SEEDED_CATEGORY_ID);
      expect(error).toBeNull();
      expect(data).toEqual([{ id: SEEDED_CATEGORY_ID }]);
    });

    it("technician can SELECT the seeded seat category (shared reference data)", async () => {
      const { data, error } = await technicianClient
        .from("seat_categories")
        .select("id")
        .eq("id", SEEDED_CATEGORY_ID);
      expect(error).toBeNull();
      expect(data).toEqual([{ id: SEEDED_CATEGORY_ID }]);
    });

    it("partner_user can SELECT the seeded seat category (shared reference data)", async () => {
      const { data, error } = await partnerAClient
        .from("seat_categories")
        .select("id")
        .eq("id", SEEDED_CATEGORY_ID);
      expect(error).toBeNull();
      expect(data).toEqual([{ id: SEEDED_CATEGORY_ID }]);
    });

    it("admin can INSERT and UPDATE a seat category", async () => {
      const { data: inserted, error: insertError } = await adminClient
        .from("seat_categories")
        .insert(newCategory("Admin"))
        .select("id")
        .single();
      expect(insertError).toBeNull();
      expect(inserted?.id).toBeDefined();
      if (inserted) createdCategoryIds.push(inserted.id);

      const { data: updated, error: updateError } = await adminClient
        .from("seat_categories")
        .update({ safety_standard: "Updated Standard" })
        .eq("id", inserted!.id)
        .select("safety_standard");
      expect(updateError).toBeNull();
      expect(updated).toEqual([{ safety_standard: "Updated Standard" }]);
    });

    it("operations_manager can INSERT and UPDATE a seat category", async () => {
      const { data: inserted, error: insertError } = await opsClient
        .from("seat_categories")
        .insert(newCategory("Ops"))
        .select("id")
        .single();
      expect(insertError).toBeNull();
      expect(inserted?.id).toBeDefined();
      if (inserted) createdCategoryIds.push(inserted.id);

      const { data: updated, error: updateError } = await opsClient
        .from("seat_categories")
        .update({ is_active: false })
        .eq("id", inserted!.id)
        .select("is_active");
      expect(updateError).toBeNull();
      expect(updated).toEqual([{ is_active: false }]);
    });

    it("technician is rejected on INSERT into seat_categories", async () => {
      const payload = newCategory("TechDenied");
      const { error } = await technicianClient
        .from("seat_categories")
        .insert(payload);
      expect(error).not.toBeNull();

      const { data: check } = await service
        .from("seat_categories")
        .select("id")
        .eq("name", payload.name);
      expect(check).toEqual([]);
    });

    it("partner_user is rejected on INSERT into seat_categories", async () => {
      const payload = newCategory("PartnerDenied");
      const { error } = await partnerAClient
        .from("seat_categories")
        .insert(payload);
      expect(error).not.toBeNull();

      const { data: check } = await service
        .from("seat_categories")
        .select("id")
        .eq("name", payload.name);
      expect(check).toEqual([]);
    });

    it("technician UPDATE of a seat category matches zero rows and leaves the row unchanged", async () => {
      const { data, error } = await technicianClient
        .from("seat_categories")
        .update({ name: "Hacked By Technician" })
        .eq("id", SEEDED_CATEGORY_ID)
        .select();
      expect(error).toBeNull();
      expect(data).toEqual([]);

      const { data: check } = await service
        .from("seat_categories")
        .select("name")
        .eq("id", SEEDED_CATEGORY_ID)
        .single();
      expect(check?.name).toBe("Infant Carrier");
    });

    it("partner_user UPDATE of a seat category matches zero rows and leaves the row unchanged", async () => {
      const { data, error } = await partnerAClient
        .from("seat_categories")
        .update({ is_active: false })
        .eq("id", SEEDED_CATEGORY_ID)
        .select();
      expect(error).toBeNull();
      expect(data).toEqual([]);

      const { data: check } = await service
        .from("seat_categories")
        .select("is_active")
        .eq("id", SEEDED_CATEGORY_ID)
        .single();
      expect(check?.is_active).toBe(true);
    });

    it("anonymous client sees no seat categories", async () => {
      const { data } = await anonClient
        .from("seat_categories")
        .select("id")
        .eq("id", SEEDED_CATEGORY_ID);
      expect(data ?? []).toEqual([]);
    });

    it("rejects max_child_age < min_child_age with a CHECK violation (23514) even for admin", async () => {
      const { error } = await adminClient.from("seat_categories").insert({
        ...newCategory("BadAge"),
        min_child_age: 24,
        max_child_age: 12,
      });
      expect(error).not.toBeNull();
      expect(error?.code).toBe("23514");
    });

    it("rejects an UPDATE that makes max_child_age < min_child_age with 23514", async () => {
      const { data: inserted } = await adminClient
        .from("seat_categories")
        .insert(newCategory("BadAgeUpdate"))
        .select("id")
        .single();
      expect(inserted?.id).toBeDefined();
      if (inserted) createdCategoryIds.push(inserted.id);

      const { error } = await adminClient
        .from("seat_categories")
        .update({ min_child_age: 50, max_child_age: 10 })
        .eq("id", inserted!.id);
      expect(error?.code).toBe("23514");
    });

    it("no role has a DELETE policy: admin delete matches zero rows and the seeded row survives", async () => {
      const { data, error } = await adminClient
        .from("seat_categories")
        .delete()
        .eq("id", SEEDED_CATEGORY_ID)
        .select();
      expect(error).toBeNull();
      expect(data).toEqual([]);

      const { data: check } = await service
        .from("seat_categories")
        .select("id")
        .eq("id", SEEDED_CATEGORY_ID)
        .maybeSingle();
      expect(check?.id).toBe(SEEDED_CATEGORY_ID);
    });

    it("no role has a DELETE policy: operations_manager and technician deletes also match zero rows", async () => {
      for (const client of [opsClient, technicianClient]) {
        const { data, error } = await client
          .from("seat_categories")
          .delete()
          .eq("id", SEEDED_CATEGORY_ID)
          .select();
        expect(error).toBeNull();
        expect(data).toEqual([]);
      }
    });

    it("hard delete of a category referenced by a seat is blocked by FK RESTRICT (23503) even via service role", async () => {
      const { data: seat } = await service
        .from("seats")
        .select("id, category_id")
        .eq("id", SEAT_A_ID)
        .single();
      expect(seat?.category_id).toBeDefined();

      const { error } = await service
        .from("seat_categories")
        .delete()
        .eq("id", seat!.category_id);
      expect(error?.code).toBe("23503");

      const { data: check } = await service
        .from("seat_categories")
        .select("id")
        .eq("id", seat!.category_id)
        .maybeSingle();
      expect(check?.id).toBe(seat!.category_id);
    });

    it("updating a category (including deactivation) leaves seats.category_id relationships intact", async () => {
      const { data: inserted } = await adminClient
        .from("seat_categories")
        .insert(newCategory("SeatLink"))
        .select("id")
        .single();
      expect(inserted?.id).toBeDefined();
      if (inserted) createdCategoryIds.push(inserted.id);

      // Snapshot the seeded seat's category, point it at the new category
      // via service role, then restore it in a finally block.
      const { data: before } = await service
        .from("seats")
        .select("category_id")
        .eq("id", SEAT_A_ID)
        .single();
      const originalCategoryId = before!.category_id;

      try {
        const { error: linkError } = await service
          .from("seats")
          .update({ category_id: inserted!.id })
          .eq("id", SEAT_A_ID);
        expect(linkError).toBeNull();

        const { error: updateError } = await adminClient
          .from("seat_categories")
          .update({ name: `${newCategory("Renamed").name}`, is_active: false })
          .eq("id", inserted!.id);
        expect(updateError).toBeNull();

        const { data: after } = await service
          .from("seats")
          .select("category_id")
          .eq("id", SEAT_A_ID)
          .single();
        expect(after?.category_id).toBe(inserted!.id);
      } finally {
        await service
          .from("seats")
          .update({ category_id: originalCategoryId })
          .eq("id", SEAT_A_ID);
      }
    });
  });

  // ===========================================================================
  // F09: seats + seat_status_history, guard trigger and change_seat_status()
  // ===========================================================================
  describe("seats table (F09)", () => {
    const SEEDED_CATEGORY_ID = "c0000000-0000-0000-0000-000000000001";
    const SECOND_CATEGORY_ID = "c0000000-0000-0000-0000-000000000002";
    const SEEDED_AIRPORT_ID = "a0000000-0000-0000-0000-000000000001";
    const MISSING_ID = "e9999999-9999-4999-8999-999999999999";

    type SeatInsert = Database["public"]["Tables"]["seats"]["Insert"];

    let secondAirportId: string;
    const createdSeatIds: string[] = [];

    const uniq = () =>
      `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const newSeat = (
      label: string,
      overrides: Partial<SeatInsert> = {},
    ): SeatInsert => ({
      serial_number: `RLS-F09-${label}-${uniq()}`,
      manufacturer: "Britax",
      model: "RLS Test Model",
      category_id: SEEDED_CATEGORY_ID,
      airport_id: SEEDED_AIRPORT_ID,
      manufacture_date: "2025-01-15",
      purchase_date: "2025-02-01",
      max_rental_cycles: 100,
      ...overrides,
    });

    /** Inserts through a real user session so the INSERT trigger sees auth.uid(). */
    async function createSeatAs(
      client: SupabaseClient<Database>,
      label: string,
      overrides: Partial<SeatInsert> = {},
    ): Promise<string> {
      const { data, error } = await client
        .from("seats")
        .insert(newSeat(label, overrides))
        .select("id")
        .single();
      if (error) throw error;
      createdSeatIds.push(data.id);
      return data.id;
    }

    async function historyOf(seatId: string) {
      const { data, error } = await service
        .from("seat_status_history")
        .select("from_status, to_status, changed_by, reason")
        .eq("seat_id", seatId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    }

    beforeAll(async () => {
      const code = `T${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const { data, error } = await service
        .from("airports")
        .insert({
          code,
          name: "F09 RLS Test Airport",
          city: "Sharjah",
          country: "United Arab Emirates",
          timezone: "Asia/Dubai",
        })
        .select("id")
        .single();
      if (error) throw error;
      secondAirportId = data.id;
    });

    afterAll(async () => {
      if (createdSeatIds.length > 0) {
        // History is append-only for users; the service role cleans up fixtures.
        await service
          .from("seat_status_history")
          .delete()
          .in("seat_id", createdSeatIds);
        await service.from("seats").delete().in("id", createdSeatIds);
      }
      if (secondAirportId) {
        await service.from("airports").delete().eq("id", secondAirportId);
      }
    });

    // ----- View -------------------------------------------------------------

    it("admin can view seats, including seats nobody has booked", async () => {
      const { data, error } = await adminClient
        .from("seats")
        .select("id, serial_number")
        .in("id", [SEAT_A_ID, SEAT_B_ID]);
      expect(error).toBeNull();
      expect(data?.map((s) => s.id).sort()).toEqual([SEAT_A_ID, SEAT_B_ID].sort());

      const { count } = await adminClient
        .from("seats")
        .select("id", { count: "exact", head: true });
      expect(count).toBeGreaterThanOrEqual(40);
    });

    it("operations_manager can view seats", async () => {
      const { data, error } = await opsClient
        .from("seats")
        .select("id")
        .in("id", [SEAT_A_ID, SEAT_B_ID]);
      expect(error).toBeNull();
      expect(data?.map((s) => s.id).sort()).toEqual([SEAT_A_ID, SEAT_B_ID].sort());
    });

    it("seat detail query returns the seat with category and airport names", async () => {
      const { data, error } = await adminClient
        .from("seats")
        .select(
          "id, serial_number, category:seat_categories(id, name), airport:airports(id, code, name)",
        )
        .eq("id", SEAT_A_ID)
        .maybeSingle();
      expect(error).toBeNull();
      expect(data?.id).toBe(SEAT_A_ID);
      expect(data?.airport).toMatchObject({ code: "DXB" });
      expect(data?.category?.name).toEqual(expect.any(String));
    });

    it("seat detail query returns null for a missing seat id", async () => {
      const { data, error } = await adminClient
        .from("seats")
        .select("id")
        .eq("id", MISSING_ID)
        .maybeSingle();
      expect(error).toBeNull();
      expect(data).toBeNull();
    });

    it("seat detail query returns null for a seat RLS hides from the caller", async () => {
      const { data, error } = await partnerAClient
        .from("seats")
        .select("id")
        .eq("id", SEAT_B_ID)
        .maybeSingle();
      expect(error).toBeNull();
      expect(data).toBeNull();
    });

    // ----- Partner / technician visibility -----------------------------------

    it("partner_user can see a seat assigned to their own partner's booking", async () => {
      const { data } = await partnerAClient
        .from("seats")
        .select("id")
        .eq("id", SEAT_A_ID);
      expect(data).toEqual([{ id: SEAT_A_ID }]);
    });

    it("partner_user cannot see another partner's seat", async () => {
      const { data, error } = await partnerAClient
        .from("seats")
        .select("id")
        .eq("id", SEAT_B_ID);
      expect(error).toBeNull();
      expect(data).toEqual([]);

      const { data: reverse } = await partnerBClient
        .from("seats")
        .select("id")
        .eq("id", SEAT_A_ID);
      expect(reverse).toEqual([]);
    });

    it("partner_user sees only seats assigned to their own partner's bookings, never unrelated inventory", async () => {
      const { data: ownBookings } = await service
        .from("bookings")
        .select("assigned_seat_id")
        .eq("partner_id", PARTNER_A_ID)
        .not("assigned_seat_id", "is", null);
      const allowed = new Set(ownBookings?.map((b) => b.assigned_seat_id));

      const { data, error } = await partnerAClient.from("seats").select("id");
      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThan(0);
      expect(data!.length).toBeLessThan(40);
      for (const seat of data!) {
        expect(allowed.has(seat.id)).toBe(true);
      }
    });

    it("partner_user with no partner_id sees no seats", async () => {
      const { data, error } = await partnerNullClient.from("seats").select("id");
      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it("technician sees no seat outside their own job's booking", async () => {
      const { data, error } = await technicianClient.from("seats").select("id");
      expect(error).toBeNull();
      expect(data!.map((s) => s.id)).not.toContain(SEAT_B_ID);
      for (const seat of data!) {
        expect(seat.id).toBe(SEAT_A_ID);
      }
    });

    it("anonymous client sees no seats", async () => {
      const { data } = await anonClient.from("seats").select("id");
      expect(data ?? []).toEqual([]);
    });

    // ----- CO-F04-S09: seat access scope (read by id and by list) ---------------

    describe("seat access scope (CO-F04-S09)", () => {
      it("partner_user can read a seat on their own partner's booking by id", async () => {
        const { data, error } = await partnerAClient
          .from("seats")
          .select("id")
          .eq("id", SEAT_A_ID)
          .maybeSingle();

        expect(error).toBeNull();
        expect(data?.id).toBe(SEAT_A_ID);
      });

      it("partner_user cannot read another partner's seat by id", async () => {
        const asPartnerA = await partnerAClient
          .from("seats")
          .select("id")
          .eq("id", SEAT_B_ID)
          .maybeSingle();
        const asPartnerB = await partnerBClient
          .from("seats")
          .select("id")
          .eq("id", SEAT_A_ID)
          .maybeSingle();

        expect(asPartnerA.error).toBeNull();
        expect(asPartnerA.data).toBeNull();
        expect(asPartnerB.error).toBeNull();
        expect(asPartnerB.data).toBeNull();
      });

      it("partner_user list never includes another partner's seat", async () => {
        const { data, error } = await partnerBClient.from("seats").select("id");

        expect(error).toBeNull();
        expect(data!.map((s) => s.id)).toContain(SEAT_B_ID);
        expect(data!.map((s) => s.id)).not.toContain(SEAT_A_ID);
      });

      it("partner_user with no partner_id cannot read a seat by id", async () => {
        const { data, error } = await partnerNullClient
          .from("seats")
          .select("id")
          .eq("id", SEAT_A_ID)
          .maybeSingle();

        expect(error).toBeNull();
        expect(data).toBeNull();
      });

      it("technician can read the seat of an assigned job by id", async () => {
        const { data, error } = await technicianClient
          .from("seats")
          .select("id")
          .eq("id", SEAT_A_ID)
          .maybeSingle();

        expect(error).toBeNull();
        expect(data?.id).toBe(SEAT_A_ID);
      });

      it("technician cannot read a seat outside their assigned jobs by id", async () => {
        const { data, error } = await technicianClient
          .from("seats")
          .select("id")
          .eq("id", SEAT_B_ID)
          .maybeSingle();

        expect(error).toBeNull();
        expect(data).toBeNull();
      });
    });

    // ----- Create -------------------------------------------------------------

    it("admin can create a seat with DB defaults for status, rental_cycles and public_token", async () => {
      const id = await createSeatAs(adminClient, "Admin");
      const { data } = await service
        .from("seats")
        .select("status, rental_cycles, public_token, retired_at, quarantine_reason")
        .eq("id", id)
        .single();
      expect(data?.status).toBe("available");
      expect(data?.rental_cycles).toBe(0);
      expect(data?.public_token.length).toBeGreaterThan(0);
      expect(data?.retired_at).toBeNull();
      expect(data?.quarantine_reason).toBeNull();
    });

    it("operations_manager can create a seat", async () => {
      const id = await createSeatAs(opsClient, "Ops");
      const { data } = await opsClient
        .from("seats")
        .select("id")
        .eq("id", id)
        .single();
      expect(data?.id).toBe(id);
    });

    it("technician is rejected on INSERT into seats", async () => {
      const payload = newSeat("TechDenied");
      const { error } = await technicianClient.from("seats").insert(payload);
      expect(error?.code).toBe("42501");

      const { data } = await service
        .from("seats")
        .select("id")
        .eq("serial_number", payload.serial_number);
      expect(data).toEqual([]);
    });

    it("partner_user is rejected on INSERT into seats", async () => {
      const payload = newSeat("PartnerDenied");
      const { error } = await partnerAClient.from("seats").insert(payload);
      expect(error?.code).toBe("42501");

      const { data } = await service
        .from("seats")
        .select("id")
        .eq("serial_number", payload.serial_number);
      expect(data).toEqual([]);
    });

    it("technician UPDATE of a seat matches zero rows and leaves the seat unchanged", async () => {
      const { data, error } = await technicianClient
        .from("seats")
        .update({ model: "Hacked By Technician" })
        .eq("id", SEAT_A_ID)
        .select();
      expect(error).toBeNull();
      expect(data).toEqual([]);

      const { data: check } = await service
        .from("seats")
        .select("model")
        .eq("id", SEAT_A_ID)
        .single();
      expect(check?.model).not.toBe("Hacked By Technician");
    });

    it("partner_user UPDATE of a seat matches zero rows and leaves the seat unchanged", async () => {
      const { data, error } = await partnerAClient
        .from("seats")
        .update({ model: "Hacked By Partner" })
        .eq("id", SEAT_A_ID)
        .select();
      expect(error).toBeNull();
      expect(data).toEqual([]);

      const { data: check } = await service
        .from("seats")
        .select("model")
        .eq("id", SEAT_A_ID)
        .single();
      expect(check?.model).not.toBe("Hacked By Partner");
    });

    // ----- Uniqueness and CHECK constraints -----------------------------------

    it("rejects a duplicate serial_number with 23505 mentioning serial_number", async () => {
      const first = newSeat("DupSerial");
      const { data: inserted, error: firstError } = await adminClient
        .from("seats")
        .insert(first)
        .select("id")
        .single();
      expect(firstError).toBeNull();
      createdSeatIds.push(inserted!.id);

      const { error } = await opsClient
        .from("seats")
        .insert(newSeat("DupSerial2", { serial_number: first.serial_number }));
      expect(error?.code).toBe("23505");
      expect(`${error?.message} ${error?.details}`).toContain("serial_number");
    });

    it("rejects a duplicate public_token with 23505 mentioning public_token", async () => {
      const id = await createSeatAs(adminClient, "DupTokenSource");
      const { data: source } = await service
        .from("seats")
        .select("public_token")
        .eq("id", id)
        .single();

      const { error } = await adminClient
        .from("seats")
        .insert(newSeat("DupToken", { public_token: source!.public_token }));
      expect(error?.code).toBe("23505");
      expect(`${error?.message} ${error?.details}`).toContain("public_token");
    });

    it("rejects max_rental_cycles = 0 on INSERT with a CHECK violation (23514)", async () => {
      const { error } = await adminClient
        .from("seats")
        .insert(newSeat("BadMax", { max_rental_cycles: 0 }));
      expect(error?.code).toBe("23514");
    });

    it("rejects a negative max_rental_cycles on INSERT with 23514", async () => {
      const { error } = await adminClient
        .from("seats")
        .insert(newSeat("NegMax", { max_rental_cycles: -5 }));
      expect(error?.code).toBe("23514");
    });

    it("rejects a negative rental_cycles on INSERT with 23514", async () => {
      const { error } = await adminClient
        .from("seats")
        .insert(newSeat("NegCycles", { rental_cycles: -1 }));
      expect(error?.code).toBe("23514");
    });

    it("rejects an UPDATE that sets max_rental_cycles to 0 with 23514", async () => {
      const id = await createSeatAs(adminClient, "BadMaxUpdate");
      const { error } = await adminClient
        .from("seats")
        .update({ max_rental_cycles: 0 })
        .eq("id", id);
      expect(error?.code).toBe("23514");
    });

    it("rejects an unknown category or airport with an FK violation (23503)", async () => {
      const badCategory = await adminClient
        .from("seats")
        .insert(newSeat("BadCat", { category_id: MISSING_ID }));
      expect(badCategory.error?.code).toBe("23503");

      const badAirport = await adminClient
        .from("seats")
        .insert(newSeat("BadAirport", { airport_id: MISSING_ID }));
      expect(badAirport.error?.code).toBe("23503");
    });

    // ----- Filtering ------------------------------------------------------------

    it("combines airport, category and status filters with AND at the database level", async () => {
      const matchId = await createSeatAs(opsClient, "FilterMatch", {
        airport_id: secondAirportId,
        category_id: SEEDED_CATEGORY_ID,
      });
      const otherAirportId = await createSeatAs(opsClient, "FilterOtherAirport", {
        airport_id: SEEDED_AIRPORT_ID,
        category_id: SEEDED_CATEGORY_ID,
      });
      const otherCategoryId = await createSeatAs(opsClient, "FilterOtherCat", {
        airport_id: secondAirportId,
        category_id: SECOND_CATEGORY_ID,
      });
      const otherStatusId = await createSeatAs(opsClient, "FilterOtherStatus", {
        airport_id: secondAirportId,
        category_id: SEEDED_CATEGORY_ID,
      });
      const ids = [matchId, otherAirportId, otherCategoryId, otherStatusId];

      for (const id of [matchId, otherAirportId, otherCategoryId]) {
        const { error } = await opsClient.rpc("change_seat_status", {
          p_seat_id: id,
          p_to_status: "quarantine",
          p_reason: "filter test",
        });
        expect(error).toBeNull();
      }

      const { data, error } = await adminClient
        .from("seats")
        .select("id")
        .in("id", ids)
        .eq("airport_id", secondAirportId)
        .eq("category_id", SEEDED_CATEGORY_ID)
        .eq("status", "quarantine");
      expect(error).toBeNull();
      expect(data).toEqual([{ id: matchId }]);

      const { data: byAirportOnly } = await adminClient
        .from("seats")
        .select("id")
        .in("id", ids)
        .eq("airport_id", secondAirportId);
      expect(byAirportOnly?.map((s) => s.id).sort()).toEqual(
        [matchId, otherCategoryId, otherStatusId].sort(),
      );
    });

    it("searches seats by serial_number with ilike", async () => {
      const id = await createSeatAs(adminClient, "SearchMe");
      const { data: seat } = await service
        .from("seats")
        .select("serial_number")
        .eq("id", id)
        .single();

      const { data } = await adminClient
        .from("seats")
        .select("id")
        .or(`serial_number.ilike."%${seat!.serial_number.slice(4, 18)}%"`);
      expect(data?.map((s) => s.id)).toContain(id);
    });

    // ----- Edit (guard trigger leaves ordinary columns alone) -----------------

    it("allows edit-form style column updates as operations_manager without writing history", async () => {
      const id = await createSeatAs(adminClient, "EditOk");
      const { data, error } = await opsClient
        .from("seats")
        .update({
          manufacturer: "Chicco",
          model: "Edited Model",
          manufacture_date: "2024-06-01",
          purchase_date: "2024-07-01",
          max_rental_cycles: 250,
          category_id: SECOND_CATEGORY_ID,
          airport_id: secondAirportId,
        })
        .eq("id", id)
        .select("manufacturer, model, max_rental_cycles, category_id, airport_id");
      expect(error).toBeNull();
      expect(data).toEqual([
        {
          manufacturer: "Chicco",
          model: "Edited Model",
          max_rental_cycles: 250,
          category_id: SECOND_CATEGORY_ID,
          airport_id: secondAirportId,
        },
      ]);
      // Only the creation row; a non-status edit writes no history.
      expect(await historyOf(id)).toHaveLength(1);
    });

    // ----- Guard trigger ----------------------------------------------------------

    describe("guard trigger on direct UPDATE", () => {
      let seatId: string;

      beforeAll(async () => {
        seatId = await createSeatAs(adminClient, "Guard");
      });

      const attempts: [string, Database["public"]["Tables"]["seats"]["Update"]][] = [
        ["status", { status: "quarantine" }],
        ["serial_number", { serial_number: "CHANGED-SERIAL" }],
        ["public_token", { public_token: "changed-token" }],
        ["retired_at", { retired_at: "2026-01-01T00:00:00Z" }],
        ["quarantine_reason", { quarantine_reason: "sneaky" }],
      ];

      it.each(attempts)(
        "should reject a direct UPDATE of %s as operations_manager with 55000",
        async (_column, patch) => {
          const { error } = await opsClient
            .from("seats")
            .update(patch)
            .eq("id", seatId);
          expect(error?.code).toBe("55000");
        },
      );

      it("should reject a direct UPDATE of status as admin with 55000", async () => {
        const { error } = await adminClient
          .from("seats")
          .update({ status: "retired" })
          .eq("id", seatId);
        expect(error?.code).toBe("55000");
      });

      it("should leave the seat untouched and write no history after rejected direct updates", async () => {
        const { data } = await service
          .from("seats")
          .select("status, serial_number, retired_at, quarantine_reason")
          .eq("id", seatId)
          .single();
        expect(data?.status).toBe("available");
        expect(data?.serial_number).not.toBe("CHANGED-SERIAL");
        expect(data?.retired_at).toBeNull();
        expect(data?.quarantine_reason).toBeNull();
        expect(await historyOf(seatId)).toHaveLength(1);
      });
    });

    // ----- change_seat_status() + history trigger ----------------------------------

    it("INSERT trigger writes the first history row with from_status null, to_status available and changed_by", async () => {
      const id = await createSeatAs(opsClient, "HistoryInsert");
      expect(await historyOf(id)).toEqual([
        {
          from_status: null,
          to_status: "available",
          changed_by: identities.opsManager.id,
          reason: null,
        },
      ]);
    });

    it("change_seat_status writes a history row with from, to, changed_by and reason", async () => {
      const id = await createSeatAs(adminClient, "Rpc");

      const { data, error } = await opsClient.rpc("change_seat_status", {
        p_seat_id: id,
        p_to_status: "quarantine",
        p_reason: "  Cracked shell  ",
      });
      expect(error).toBeNull();
      expect(data).toMatchObject({
        id,
        status: "quarantine",
        quarantine_reason: "Cracked shell",
      });

      const history = await historyOf(id);
      expect(history).toHaveLength(2);
      expect(history[1]).toEqual({
        from_status: "available",
        to_status: "quarantine",
        changed_by: identities.opsManager.id,
        reason: "Cracked shell",
      });
    });

    it("moving a seat out of quarantine clears quarantine_reason and records the change", async () => {
      const id = await createSeatAs(adminClient, "Release");
      await opsClient.rpc("change_seat_status", {
        p_seat_id: id,
        p_to_status: "quarantine",
        p_reason: "inspection pending",
      });

      const { data, error } = await adminClient.rpc("change_seat_status", {
        p_seat_id: id,
        p_to_status: "available",
        p_reason: "cleared after review",
      });
      expect(error).toBeNull();
      expect(data).toMatchObject({ status: "available", quarantine_reason: null });

      const history = await historyOf(id);
      expect(history.map((h) => [h.from_status, h.to_status])).toEqual([
        [null, "available"],
        ["available", "quarantine"],
        ["quarantine", "available"],
      ]);
      expect(history[2]).toMatchObject({
        changed_by: identities.admin.id,
        reason: "cleared after review",
      });
    });

    it("retiring a seat sets retired_at and records the change with a null reason when none is given", async () => {
      const id = await createSeatAs(adminClient, "Retire");

      const { data, error } = await opsClient.rpc("change_seat_status", {
        p_seat_id: id,
        p_to_status: "retired",
        p_reason: "",
      });
      expect(error).toBeNull();
      expect(data?.status).toBe("retired");
      expect(data?.retired_at).not.toBeNull();

      const history = await historyOf(id);
      expect(history.at(-1)).toEqual({
        from_status: "available",
        to_status: "retired",
        changed_by: identities.opsManager.id,
        reason: null,
      });
    });

    it("a retired seat cannot leave retired through the RPC (55000)", async () => {
      const id = await createSeatAs(adminClient, "RetiredTerminal");
      await adminClient.rpc("change_seat_status", {
        p_seat_id: id,
        p_to_status: "retired",
        p_reason: "",
      });

      for (const target of ["available", "quarantine", "retired"] as const) {
        const { error } = await adminClient.rpc("change_seat_status", {
          p_seat_id: id,
          p_to_status: target,
          p_reason: "try again",
        });
        expect(error?.code).toBe("55000");
      }
      const { data } = await service
        .from("seats")
        .select("status")
        .eq("id", id)
        .single();
      expect(data?.status).toBe("retired");
    });

    it("a retired seat cannot leave retired through a direct UPDATE (55000)", async () => {
      const id = await createSeatAs(adminClient, "RetiredDirect");
      await adminClient.rpc("change_seat_status", {
        p_seat_id: id,
        p_to_status: "retired",
        p_reason: "",
      });

      const { error } = await adminClient
        .from("seats")
        .update({ status: "available" })
        .eq("id", id);
      expect(error?.code).toBe("55000");
    });

    it("change_seat_status returns P0002 for a seat that does not exist", async () => {
      const { error } = await adminClient.rpc("change_seat_status", {
        p_seat_id: MISSING_ID,
        p_to_status: "retired",
        p_reason: "",
      });
      expect(error?.code).toBe("P0002");
    });

    it("change_seat_status returns 55000 for a transition that is not allowed", async () => {
      const id = await createSeatAs(adminClient, "BadTransition");

      const sameStatus = await adminClient.rpc("change_seat_status", {
        p_seat_id: id,
        p_to_status: "available",
        p_reason: "",
      });
      expect(sameStatus.error?.code).toBe("55000");

      const operational = await adminClient.rpc("change_seat_status", {
        p_seat_id: id,
        p_to_status: "in_use",
        p_reason: "",
      });
      expect(operational.error?.code).toBe("55000");

      expect(await historyOf(id)).toHaveLength(1);
    });

    it("change_seat_status returns 22023 when quarantining without a reason", async () => {
      const id = await createSeatAs(adminClient, "NoReason");

      for (const reason of ["", "   "]) {
        const { error } = await adminClient.rpc("change_seat_status", {
          p_seat_id: id,
          p_to_status: "quarantine",
          p_reason: reason,
        });
        expect(error?.code).toBe("22023");
      }

      const { data } = await service
        .from("seats")
        .select("status")
        .eq("id", id)
        .single();
      expect(data?.status).toBe("available");
      expect(await historyOf(id)).toHaveLength(1);
    });

    it("technician calling change_seat_status changes nothing and writes no history", async () => {
      const id = await createSeatAs(adminClient, "TechRpc");

      const { error } = await technicianClient.rpc("change_seat_status", {
        p_seat_id: id,
        p_to_status: "quarantine",
        p_reason: "technician attempt",
      });
      expect(error).not.toBeNull();

      const { data } = await service
        .from("seats")
        .select("status, quarantine_reason")
        .eq("id", id)
        .single();
      expect(data).toEqual({ status: "available", quarantine_reason: null });
      expect(await historyOf(id)).toHaveLength(1);
    });

    it("partner_user calling change_seat_status changes nothing and writes no history", async () => {
      const id = await createSeatAs(adminClient, "PartnerRpc");

      const { error } = await partnerAClient.rpc("change_seat_status", {
        p_seat_id: id,
        p_to_status: "quarantine",
        p_reason: "partner attempt",
      });
      expect(error).not.toBeNull();

      const { data } = await service
        .from("seats")
        .select("status")
        .eq("id", id)
        .single();
      expect(data?.status).toBe("available");
      expect(await historyOf(id)).toHaveLength(1);
    });

    it("anonymous client cannot execute change_seat_status", async () => {
      const id = await createSeatAs(adminClient, "AnonRpc");

      const { error } = await anonClient.rpc("change_seat_status", {
        p_seat_id: id,
        p_to_status: "retired",
        p_reason: "",
      });
      expect(error).not.toBeNull();

      const { data } = await service
        .from("seats")
        .select("status")
        .eq("id", id)
        .single();
      expect(data?.status).toBe("available");
    });

    // ----- seat_status_history: append-only and access ------------------------------

    describe("seat_status_history", () => {
      let seatId: string;

      beforeAll(async () => {
        seatId = await createSeatAs(adminClient, "History");
        const { error } = await opsClient.rpc("change_seat_status", {
          p_seat_id: seatId,
          p_to_status: "quarantine",
          p_reason: "history fixture",
        });
        if (error) throw error;
      });

      it("admin and operations_manager can read history rows", async () => {
        for (const client of [adminClient, opsClient]) {
          const { data, error } = await client
            .from("seat_status_history")
            .select("id, to_status")
            .eq("seat_id", seatId);
          expect(error).toBeNull();
          expect(data).toHaveLength(2);
        }
      });

      it("UPDATE of a history row matches zero rows and leaves it unchanged (append-only)", async () => {
        for (const client of [adminClient, opsClient]) {
          const { data, error } = await client
            .from("seat_status_history")
            .update({ reason: "tampered", to_status: "retired" })
            .eq("seat_id", seatId)
            .select();
          expect(error).toBeNull();
          expect(data).toEqual([]);
        }

        const history = await historyOf(seatId);
        expect(history.map((h) => h.to_status)).toEqual([
          "available",
          "quarantine",
        ]);
        expect(history[1].reason).toBe("history fixture");
      });

      it("DELETE of a history row matches zero rows and the rows survive (append-only)", async () => {
        for (const client of [adminClient, opsClient]) {
          const { data, error } = await client
            .from("seat_status_history")
            .delete()
            .eq("seat_id", seatId)
            .select();
          expect(error).toBeNull();
          expect(data).toEqual([]);
        }
        expect(await historyOf(seatId)).toHaveLength(2);
      });

      it("technician cannot read or insert history rows", async () => {
        const { data, error } = await technicianClient
          .from("seat_status_history")
          .select("id")
          .eq("seat_id", seatId);
        expect(error).toBeNull();
        expect(data).toEqual([]);

        const insert = await technicianClient
          .from("seat_status_history")
          .insert({ seat_id: seatId, to_status: "retired" });
        expect(insert.error?.code).toBe("42501");
        expect(await historyOf(seatId)).toHaveLength(2);
      });

      it("partner_user cannot read or insert history rows", async () => {
        const { data, error } = await partnerAClient
          .from("seat_status_history")
          .select("id")
          .eq("seat_id", seatId);
        expect(error).toBeNull();
        expect(data).toEqual([]);

        const insert = await partnerAClient
          .from("seat_status_history")
          .insert({ seat_id: seatId, to_status: "retired" });
        expect(insert.error?.code).toBe("42501");
        expect(await historyOf(seatId)).toHaveLength(2);
      });

      it("partner_user cannot read history of a seat assigned to their own booking (cross-tenant boundary)", async () => {
        const { data, error } = await partnerAClient
          .from("seat_status_history")
          .select("id")
          .eq("seat_id", SEAT_A_ID);
        expect(error).toBeNull();
        expect(data).toEqual([]);
      });

      it("anonymous client sees no history rows", async () => {
        const { data } = await anonClient
          .from("seat_status_history")
          .select("id")
          .eq("seat_id", seatId);
        expect(data ?? []).toEqual([]);
      });
    });

    // ----- Delete protection ---------------------------------------------------------

    it("no role has a DELETE policy on seats: admin, operations_manager and technician deletes match zero rows", async () => {
      const id = await createSeatAs(adminClient, "NoDelete");

      for (const client of [adminClient, opsClient, technicianClient]) {
        const { data, error } = await client
          .from("seats")
          .delete()
          .eq("id", id)
          .select();
        expect(error).toBeNull();
        expect(data).toEqual([]);
      }

      const { data: check } = await service
        .from("seats")
        .select("id")
        .eq("id", id)
        .maybeSingle();
      expect(check?.id).toBe(id);
    });

    it("hard delete of a seat with history is blocked by FK RESTRICT (23503) even via service role", async () => {
      const id = await createSeatAs(adminClient, "FkHistory");

      const { error } = await service.from("seats").delete().eq("id", id);
      expect(error?.code).toBe("23503");
      expect(error?.message).toContain("seat_status_history");
    });

    it("hard delete of a seat referenced by a cleaning record is blocked by FK RESTRICT (23503)", async () => {
      const id = await createSeatAs(adminClient, "FkCleaning");
      // Remove the history row so the cleaning record is the only reference.
      await service.from("seat_status_history").delete().eq("seat_id", id);

      const { data: cleaning, error: insertError } = await service
        .from("cleaning_records")
        .insert({
          seat_id: id,
          booking_id: BOOKING_A_ID,
          employee_id: identities.technician.id,
          started_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      expect(insertError).toBeNull();

      try {
        const { error } = await service.from("seats").delete().eq("id", id);
        expect(error?.code).toBe("23503");
        expect(error?.message).toContain("cleaning_records");
      } finally {
        await service.from("cleaning_records").delete().eq("id", cleaning!.id);
      }
    });

    it("hard delete of a seat referenced by an inspection record is blocked by FK RESTRICT (23503)", async () => {
      const id = await createSeatAs(adminClient, "FkInspection");
      await service.from("seat_status_history").delete().eq("seat_id", id);

      const { data: inspection, error: insertError } = await service
        .from("inspection_records")
        .insert({
          seat_id: id,
          booking_id: BOOKING_A_ID,
          inspector_id: identities.technician.id,
          inspection_type: "pre_rental",
          result: "pass",
        })
        .select("id")
        .single();
      expect(insertError).toBeNull();

      try {
        const { error } = await service.from("seats").delete().eq("id", id);
        expect(error?.code).toBe("23503");
        expect(error?.message).toContain("inspection_records");
      } finally {
        await service
          .from("inspection_records")
          .delete()
          .eq("id", inspection!.id);
      }
    });

    // ----- Cross-tenant ---------------------------------------------------------------

    it("partner_user cannot mutate or change the status of a seat belonging to another partner's booking", async () => {
      const { data, error } = await partnerAClient
        .from("seats")
        .update({ model: "Cross Tenant Edit" })
        .eq("id", SEAT_B_ID)
        .select();
      expect(error).toBeNull();
      expect(data).toEqual([]);

      const { error: rpcError } = await partnerAClient.rpc(
        "change_seat_status",
        { p_seat_id: SEAT_B_ID, p_to_status: "retired", p_reason: "" },
      );
      expect(rpcError?.code).toBe("P0002");

      const { data: check } = await service
        .from("seats")
        .select("model, status")
        .eq("id", SEAT_B_ID)
        .single();
      expect(check?.model).not.toBe("Cross Tenant Edit");
      expect(check?.status).toBe("available");
    });
  });
  // ===========================================================================
  // F11: booking management (RPCs, guard trigger, append-only booking_events)
  // ===========================================================================
  describe("bookings (F11)", () => {
    const CATEGORY_1 = "c0000000-0000-0000-0000-000000000001";
    const CATEGORY_2 = "c0000000-0000-0000-0000-000000000002";
    const DXB = "a0000000-0000-0000-0000-000000000001";
    // Fresh seats are created per run, so these fixed windows never collide
    // with seeded bookings (2026-09) or earlier runs.
    const T = (day: number, hour = 8) =>
      `2031-03-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00Z`;

    const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    let otherAirportId: string;
    let inactivePartnerId: string;
    let seat1: string;
    let seat2: string;
    let seat3: string;
    let seatQuarantined: string;
    let seatCategory2: string;
    let seatOtherAirport: string;
    const createdSeatIds: string[] = [];

    async function newSeat(
      overrides: Partial<Database["public"]["Tables"]["seats"]["Insert"]> = {},
    ): Promise<string> {
      const { data, error } = await service
        .from("seats")
        .insert({
          serial_number: `RLS-F11-${uniq()}`,
          manufacturer: "Britax",
          model: "F11 Test",
          category_id: CATEGORY_1,
          airport_id: DXB,
          manufacture_date: "2025-01-15",
          purchase_date: "2025-02-01",
          max_rental_cycles: 100,
          ...overrides,
        })
        .select("id")
        .single();
      if (error) throw error;
      createdSeatIds.push(data.id);
      return data.id;
    }

    interface CreateOverrides {
      p_partner_id?: string;
      p_airport_id?: string;
      p_seat_category_id?: string;
      p_pickup_at?: string;
      p_return_at?: string;
      p_daily_rate?: number;
      p_assigned_seat_id?: string;
      p_notes?: string;
    }

    function createArgs(o: CreateOverrides = {}) {
      return {
        p_partner_id: PARTNER_A_ID,
        p_airport_id: DXB,
        p_seat_category_id: CATEGORY_1,
        p_pickup_at: T(1),
        p_return_at: T(3),
        p_daily_rate: 75,
        ...o,
      };
    }

    async function createAs(
      client: SupabaseClient<Database>,
      o: CreateOverrides = {},
    ) {
      return client.rpc("create_booking", createArgs(o));
    }

    async function createOk(o: CreateOverrides = {}) {
      const { data, error } = await createAs(opsClient, o);
      if (error) throw error;
      return data;
    }

    async function eventsOf(bookingId: string) {
      const { data, error } = await service
        .from("booking_events")
        .select("from_status, to_status, user_id, notes, metadata, created_at")
        .eq("booking_id", bookingId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    }

    const eventTypes = (events: { metadata: unknown }[]) =>
      events.map((e) => (e.metadata as { event_type: string }).event_type);

    beforeAll(async () => {
      const code = `T${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const airport = await service
        .from("airports")
        .insert({
          code,
          name: "F11 RLS Test Airport",
          city: "Sharjah",
          country: "United Arab Emirates",
          timezone: "Asia/Dubai",
        })
        .select("id")
        .single();
      if (airport.error) throw airport.error;
      otherAirportId = airport.data.id;

      const partner = await service
        .from("partners")
        .insert({
          name: `F11 Suspended ${uniq()}`,
          code: `F11${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
          contact_email: "f11@test.local",
          status: "suspended",
        })
        .select("id")
        .single();
      if (partner.error) throw partner.error;
      inactivePartnerId = partner.data.id;

      seat1 = await newSeat();
      seat2 = await newSeat();
      seat3 = await newSeat();
      seatQuarantined = await newSeat();
      seatCategory2 = await newSeat({ category_id: CATEGORY_2 });
      seatOtherAirport = await newSeat({ airport_id: otherAirportId });

      const { error } = await opsClient.rpc("change_seat_status", {
        p_seat_id: seatQuarantined,
        p_to_status: "quarantine",
        p_reason: "F11 test",
      });
      if (error) throw error;
    }, 60_000);

    afterAll(async () => {
      // Bookings (and their append-only events) cannot be deleted; they stay
      // until `supabase db reset`. Seats can be: the FK action nulls
      // bookings.assigned_seat_id / booking_events.seat_id.
      if (createdSeatIds.length > 0) {
        await service
          .from("seat_status_history")
          .delete()
          .in("seat_id", createdSeatIds);
        await service.from("seats").delete().in("id", createdSeatIds);
      }
      if (otherAirportId) {
        await service.from("airports").delete().eq("id", otherAirportId);
      }
      if (inactivePartnerId) {
        await service.from("partners").delete().eq("id", inactivePartnerId);
      }
    });

    // ----- Create + numbering + events --------------------------------------

    it("operations_manager can create a booking: pending, generated number, exactly one created event", async () => {
      const booking = await createOk();

      expect(booking.status).toBe("pending");
      expect(booking.booking_number).toMatch(/^BK-\d{5}$/);
      expect(Number(booking.booking_number.slice(3))).toBeGreaterThan(20);

      const events = await eventsOf(booking.id);
      expect(events).toHaveLength(1);
      expect(events[0].from_status).toBeNull();
      expect(events[0].to_status).toBe("pending");
      expect(events[0].user_id).toBe(identities.opsManager.id);
      expect(eventTypes(events)).toEqual(["created"]);
    });

    it("admin can create a booking, and booking numbers are unique and increasing", async () => {
      const first = await createAs(adminClient);
      const second = await createAs(adminClient);

      expect(first.error).toBeNull();
      expect(second.error).toBeNull();
      expect(Number(second.data!.booking_number.slice(3))).toBeGreaterThan(
        Number(first.data!.booking_number.slice(3)),
      );
    });

    it("rejects return before pickup, a negative rate, an inactive partner and an unknown airport", async () => {
      const cases: CreateOverrides[] = [
        { p_pickup_at: T(5), p_return_at: T(4) },
        { p_daily_rate: -1 },
        { p_partner_id: inactivePartnerId },
        { p_airport_id: "a9999999-9999-4999-8999-999999999999" },
      ];

      for (const c of cases) {
        const { error } = await createAs(opsClient, c);
        expect(error?.code).toBe("22023");
      }
    });

    // ----- Read / role boundaries -------------------------------------------

    it("admin and operations_manager can read any partner's booking", async () => {
      const booking = await createOk({ p_partner_id: PARTNER_B_ID });

      for (const client of [adminClient, opsClient]) {
        const { data } = await client.from("bookings").select("id").eq("id", booking.id);
        expect(data).toHaveLength(1);
      }
    });

    it("partner A sees its own new booking but not partner B's, in list and by id", async () => {
      const own = await createOk({ p_partner_id: PARTNER_A_ID });
      const other = await createOk({ p_partner_id: PARTNER_B_ID });

      // Newest first: older runs leave bookings behind, and PostgREST caps an
      // unordered list at max_rows, which could hide the booking just created.
      const { data: list } = await partnerAClient
        .from("bookings")
        .select("id, partner_id")
        .order("created_at", { ascending: false });
      expect(list!.some((b) => b.id === own.id)).toBe(true);
      expect(list!.every((b) => b.partner_id === PARTNER_A_ID)).toBe(true);

      const { data: byId } = await partnerAClient.from("bookings").select("id").eq("id", other.id);
      expect(byId).toEqual([]);

      const { data: events } = await partnerAClient
        .from("booking_events")
        .select("id")
        .eq("booking_id", other.id);
      expect(events).toEqual([]);
    });

    it("partner_user cannot create or modify bookings (RPC, direct insert and direct update)", async () => {
      const { error: rpcError } = await createAs(partnerAClient);
      expect(rpcError?.code).toBe("42501");

      const { error: insertError } = await partnerAClient.from("bookings").insert({
        booking_number: `BK-F11-${uniq()}`,
        partner_id: PARTNER_A_ID,
        airport_id: DXB,
        seat_category_id: CATEGORY_1,
        pickup_at: T(1),
        return_at: T(2),
        daily_rate: 1,
      });
      expect(insertError).not.toBeNull();

      const own = await createOk({ p_partner_id: PARTNER_A_ID });
      const { data: updated } = await partnerAClient
        .from("bookings")
        .update({ notes: "partner edit" })
        .eq("id", own.id)
        .select();
      expect(updated).toEqual([]);

      const { error: statusError } = await partnerAClient.rpc("change_booking_status", {
        p_booking_id: own.id,
        p_to_status: "confirmed",
      });
      expect(statusError?.code).toBe("42501");
    });

    it("a partner_user with NULL partner_id and an inactive user get zero rows", async () => {
      await createOk();

      const nullPartner = await partnerNullClient.from("bookings").select("id");
      expect(nullPartner.data ?? []).toEqual([]);

      const inactive = await inactiveClient.from("bookings").select("id");
      expect(inactive.data ?? []).toEqual([]);
    });

    it("anonymous and inactive callers cannot call the booking RPCs", async () => {
      const anon = await createAs(anonClient);
      expect(anon.error).not.toBeNull();

      const inactive = await createAs(inactiveClient);
      expect(inactive.error?.code).toBe("42501");
    });

    it("technician sees only bookings they are assigned to, and cannot create", async () => {
      const mine = await createOk();
      const notMine = await createOk();
      const { error: assignError } = await service
        .from("bookings")
        .update({ assigned_technician_id: identities.technician.id })
        .eq("id", mine.id);
      expect(assignError).toBeNull();

      const { data } = await technicianClient
        .from("bookings")
        .select("id")
        .in("id", [mine.id, notMine.id]);
      expect(data?.map((b) => b.id)).toEqual([mine.id]);

      const { error } = await createAs(technicianClient);
      expect(error?.code).toBe("42501");
    });

    it("denies direct INSERT into bookings for client roles, while create_booking still works", async () => {
      const row = {
        booking_number: `BK-F11-${uniq()}`,
        partner_id: PARTNER_A_ID,
        airport_id: DXB,
        seat_category_id: CATEGORY_1,
        pickup_at: T(1),
        return_at: T(2),
        daily_rate: 1,
      };

      for (const client of [adminClient, opsClient]) {
        const { error } = await client.from("bookings").insert(row);
        expect(error?.code).toBe("55000");
      }

      const { error: serviceError } = await service.from("bookings").insert(row);
      expect(serviceError?.code).toBe("55000");

      const { error } = await createAs(adminClient);
      expect(error).toBeNull();
    });

    it("rejects null pickup or return times in create_booking and update_booking (22023)", async () => {
      const nullPickup = await opsClient.rpc("create_booking", {
        ...createArgs(),
        p_pickup_at: null as unknown as string,
      });
      expect(nullPickup.error?.code).toBe("22023");

      const booking = await createOk();
      const nullReturn = await opsClient.rpc("update_booking", {
        p_booking_id: booking.id,
        p_expected_updated_at: booking.updated_at,
        p_pickup_at: booking.pickup_at,
        p_return_at: null as unknown as string,
      });
      expect(nullReturn.error?.code).toBe("22023");
    });

    it("pins that unguarded columns stay directly editable on a terminal booking (terminal rules apply to the RPC path only)", async () => {
      const booking = await createOk();
      await opsClient.rpc("change_booking_status", {
        p_booking_id: booking.id,
        p_to_status: "cancelled",
        p_reason: "x",
      });

      const { error } = await opsClient
        .from("bookings")
        .update({ notes: "edited after cancel", vehicle: "V" })
        .eq("id", booking.id);
      expect(error).toBeNull();

      const viaRpc = await opsClient.rpc("update_booking", {
        p_booking_id: booking.id,
        p_expected_updated_at: booking.updated_at,
        p_pickup_at: booking.pickup_at,
        p_return_at: booking.return_at,
      });
      expect(viaRpc.error).not.toBeNull();
    });

    // ----- Seat rules -------------------------------------------------------

    it("assigns an available seat without changing seats.status", async () => {
      const booking = await createOk({
        p_assigned_seat_id: seat1,
        p_pickup_at: T(10),
        p_return_at: T(12),
      });

      expect(booking.assigned_seat_id).toBe(seat1);
      const { data: seat } = await service.from("seats").select("status").eq("id", seat1).single();
      expect(seat?.status).toBe("available");
    });

    it("rejects a seat that is not available (BK001), the wrong category (BK003) or another airport (BK003)", async () => {
      const notAvailable = await createAs(opsClient, { p_assigned_seat_id: seatQuarantined });
      expect(notAvailable.error?.code).toBe("BK001");

      const wrongCategory = await createAs(opsClient, { p_assigned_seat_id: seatCategory2 });
      expect(wrongCategory.error?.code).toBe("BK003");

      const wrongAirport = await createAs(opsClient, { p_assigned_seat_id: seatOtherAirport });
      expect(wrongAirport.error?.code).toBe("BK003");

      const missing = await createAs(opsClient, {
        p_assigned_seat_id: "e9999999-9999-4999-8999-999999999999",
      });
      expect(missing.error?.code).toBe("BK005");
    });

    it("rejects overlapping bookings on one seat (BK002) but allows touching endpoints", async () => {
      await createOk({ p_assigned_seat_id: seat2, p_pickup_at: T(10), p_return_at: T(12) });

      const overlap = await createAs(opsClient, {
        p_assigned_seat_id: seat2,
        p_pickup_at: T(11),
        p_return_at: T(13),
      });
      expect(overlap.error?.code).toBe("BK002");

      const touchingAfter = await createAs(opsClient, {
        p_assigned_seat_id: seat2,
        p_pickup_at: T(12),
        p_return_at: T(14),
      });
      expect(touchingAfter.error).toBeNull();

      const touchingBefore = await createAs(opsClient, {
        p_assigned_seat_id: seat2,
        p_pickup_at: T(8),
        p_return_at: T(10),
      });
      expect(touchingBefore.error).toBeNull();
    });

    it("frees the seat for that period once the booking is cancelled", async () => {
      const seat = await newSeat();
      const first = await createOk({ p_assigned_seat_id: seat, p_pickup_at: T(20), p_return_at: T(22) });

      const blocked = await createAs(opsClient, {
        p_assigned_seat_id: seat,
        p_pickup_at: T(20),
        p_return_at: T(22),
      });
      expect(blocked.error?.code).toBe("BK002");

      const { error: cancelError } = await opsClient.rpc("change_booking_status", {
        p_booking_id: first.id,
        p_to_status: "cancelled",
        p_reason: "test",
      });
      expect(cancelError).toBeNull();

      const again = await createAs(opsClient, {
        p_assigned_seat_id: seat,
        p_pickup_at: T(20),
        p_return_at: T(22),
      });
      expect(again.error).toBeNull();
    });

    it("lets exactly one of two concurrent create_booking calls win the same seat", async () => {
      const seat = await newSeat();
      const args = { p_assigned_seat_id: seat, p_pickup_at: T(24), p_return_at: T(26) };

      const results = await Promise.all([createAs(opsClient, args), createAs(adminClient, args)]);

      expect(results.filter((r) => r.error === null)).toHaveLength(1);
      const loser = results.find((r) => r.error !== null);
      expect(loser?.error?.code).toBe("BK002");
    });

    it("get_available_seats lists free seats and excludes booked, quarantined and mismatched ones", async () => {
      const seat = await newSeat();
      await createOk({ p_assigned_seat_id: seat, p_pickup_at: T(15), p_return_at: T(17) });

      const { data, error } = await opsClient.rpc("get_available_seats", {
        p_airport_id: DXB,
        p_seat_category_id: CATEGORY_1,
        p_pickup_at: T(15),
        p_return_at: T(17),
      });
      expect(error).toBeNull();
      const ids = data!.map((s) => s.id);
      expect(ids).toContain(seat3);
      expect(ids).not.toContain(seat);
      expect(ids).not.toContain(seatQuarantined);
      expect(ids).not.toContain(seatCategory2);
      expect(ids).not.toContain(seatOtherAirport);

      const asPartner = await partnerAClient.rpc("get_available_seats", {
        p_airport_id: DXB,
        p_seat_category_id: CATEGORY_1,
        p_pickup_at: T(15),
        p_return_at: T(17),
      });
      expect(asPartner.data ?? []).toEqual([]);
    });

    // ----- Status transitions -----------------------------------------------

    it("records a valid transition with from/to status, user, reason and event type", async () => {
      const booking = await createOk();

      const confirm = await opsClient.rpc("change_booking_status", {
        p_booking_id: booking.id,
        p_to_status: "confirmed",
      });
      expect(confirm.error).toBeNull();

      const noShow = await opsClient.rpc("change_booking_status", {
        p_booking_id: booking.id,
        p_to_status: "no_show",
        p_reason: "  Did not arrive  ",
      });
      expect(noShow.error).toBeNull();

      const events = await eventsOf(booking.id);
      expect(eventTypes(events)).toEqual(["created", "status_changed", "status_changed"]);
      expect(events[2]).toMatchObject({
        from_status: "confirmed",
        to_status: "no_show",
        user_id: identities.opsManager.id,
        notes: "Did not arrive",
      });
    });

    it("rejects invalid transitions (pending to no_show, terminal to anything) and writes no event", async () => {
      const booking = await createOk();

      const pendingNoShow = await opsClient.rpc("change_booking_status", {
        p_booking_id: booking.id,
        p_to_status: "no_show",
        p_reason: "x",
      });
      expect(pendingNoShow.error?.code).toBe("55000");

      await opsClient.rpc("change_booking_status", {
        p_booking_id: booking.id,
        p_to_status: "cancelled",
        p_reason: "x",
      });
      const eventsBefore = (await eventsOf(booking.id)).length;

      const fromTerminal = await opsClient.rpc("change_booking_status", {
        p_booking_id: booking.id,
        p_to_status: "confirmed",
      });
      expect(fromTerminal.error?.code).toBe("55000");

      const workflowOwned = await opsClient.rpc("change_booking_status", {
        p_booking_id: booking.id,
        p_to_status: "completed",
        p_reason: "x",
      });
      expect(workflowOwned.error?.code).toBe("55000");

      expect(await eventsOf(booking.id)).toHaveLength(eventsBefore);
    });

    it("requires a reason to cancel or mark no-show (22023) and reports a missing booking as P0002", async () => {
      const booking = await createOk();

      const noReason = await opsClient.rpc("change_booking_status", {
        p_booking_id: booking.id,
        p_to_status: "cancelled",
        p_reason: "   ",
      });
      expect(noReason.error?.code).toBe("22023");

      const missing = await opsClient.rpc("change_booking_status", {
        p_booking_id: "f9999999-9999-4999-8999-999999999999",
        p_to_status: "confirmed",
      });
      expect(missing.error?.code).toBe("P0002");
    });

    // ----- Guard trigger ----------------------------------------------------

    it("blocks direct PATCH of status, assigned_seat_id, partner_id, booking_number and daily_rate (55000)", async () => {
      const booking = await createOk();
      const patches = [
        { status: "confirmed" as const },
        { assigned_seat_id: seat3 },
        { partner_id: PARTNER_B_ID },
        { booking_number: `BK-X-${uniq()}` },
        { daily_rate: 1 },
        { pickup_at: T(2) },
      ];

      for (const patch of patches) {
        const { error } = await opsClient.from("bookings").update(patch).eq("id", booking.id);
        expect(error?.code).toBe("55000");
      }

      const { data } = await service.from("bookings").select("status, partner_id, daily_rate").eq("id", booking.id).single();
      expect(data).toMatchObject({ status: "pending", partner_id: PARTNER_A_ID, daily_rate: 75 });
    });

    it("still allows direct update of unguarded columns (notes) and records an updated event", async () => {
      const booking = await createOk();

      const { error } = await opsClient.from("bookings").update({ notes: "direct note" }).eq("id", booking.id);
      expect(error).toBeNull();

      const events = await eventsOf(booking.id);
      expect(eventTypes(events)).toEqual(["created", "updated"]);
    });

    // ----- update_booking ---------------------------------------------------

    it("update_booking changes the seat, records seat_changed and rejects a stale expected_updated_at (BK004)", async () => {
      const seat = await newSeat();
      const booking = await createOk({ p_pickup_at: T(18), p_return_at: T(19) });

      const updated = await opsClient.rpc("update_booking", {
        p_booking_id: booking.id,
        p_expected_updated_at: booking.updated_at,
        p_pickup_at: booking.pickup_at,
        p_return_at: booking.return_at,
        p_assigned_seat_id: seat,
      });
      expect(updated.error).toBeNull();
      expect(updated.data!.assigned_seat_id).toBe(seat);
      expect(eventTypes(await eventsOf(booking.id))).toEqual(["created", "seat_changed"]);

      const stale = await opsClient.rpc("update_booking", {
        p_booking_id: booking.id,
        p_expected_updated_at: booking.updated_at,
        p_pickup_at: booking.pickup_at,
        p_return_at: booking.return_at,
        p_notes: "late edit",
      });
      expect(stale.error?.code).toBe("BK004");
    });

    it("update_booking rejects a terminal booking (55000) and a conflicting new period (BK002)", async () => {
      const seat = await newSeat();
      await createOk({ p_assigned_seat_id: seat, p_pickup_at: T(27), p_return_at: T(28) });
      const mine = await createOk({ p_assigned_seat_id: seat, p_pickup_at: T(28), p_return_at: T(29) });

      const conflict = await opsClient.rpc("update_booking", {
        p_booking_id: mine.id,
        p_expected_updated_at: mine.updated_at,
        p_pickup_at: T(27, 12),
        p_return_at: T(29),
        p_assigned_seat_id: seat,
      });
      expect(conflict.error?.code).toBe("BK002");

      const cancelled = await opsClient.rpc("change_booking_status", {
        p_booking_id: mine.id,
        p_to_status: "cancelled",
        p_reason: "x",
      });
      const { data: fresh } = await service.from("bookings").select("updated_at").eq("id", mine.id).single();
      expect(cancelled.error).toBeNull();

      const terminal = await opsClient.rpc("update_booking", {
        p_booking_id: mine.id,
        p_expected_updated_at: fresh!.updated_at,
        p_pickup_at: mine.pickup_at,
        p_return_at: mine.return_at,
      });
      expect(terminal.error?.code).toBe("55000");
    });

    it("writes the events of one update_booking in a stable order: seat_changed, then updated (oldest first)", async () => {
      const seat = await newSeat();
      const booking = await createOk({ p_pickup_at: T(30), p_return_at: T(31) });

      const { error } = await opsClient.rpc("update_booking", {
        p_booking_id: booking.id,
        p_expected_updated_at: booking.updated_at,
        p_pickup_at: booking.pickup_at,
        p_return_at: booking.return_at,
        p_assigned_seat_id: seat,
        p_notes: "order check",
      });
      expect(error).toBeNull();

      const events = await eventsOf(booking.id);
      expect(eventTypes(events)).toEqual(["created", "seat_changed", "updated"]);

      // Compare the raw strings: they keep microseconds, Date would round to ms.
      const times = events.map((e) => e.created_at);
      expect(new Set(times).size).toBe(times.length);
      expect([...times].sort()).toEqual(times);
    });

    // ----- Drift: booking-status.ts must match the SQL behaviour ------------

    // Only these statuses are reachable by a client; assigned, in_progress and
    // completed belong to later workflows and cannot be produced here.
    const REACHABLE = ["pending", "confirmed", "cancelled", "no_show"] as const;

    async function bookingIn(
      status: (typeof REACHABLE)[number],
      o: CreateOverrides = {},
    ) {
      const booking = await createOk(o);
      const steps: [string, string][] =
        status === "pending"
          ? []
          : status === "confirmed"
            ? [["confirmed", ""]]
            : status === "cancelled"
              ? [["cancelled", "drift"]]
              : [["confirmed", ""], ["no_show", "drift"]];

      for (const [to, reason] of steps) {
        const { error } = await opsClient.rpc("change_booking_status", {
          p_booking_id: booking.id,
          p_to_status: to as Database["public"]["Enums"]["booking_status"],
          p_reason: reason,
        });
        if (error) throw error;
      }
      return booking;
    }

    it("matches the TypeScript transition table and reason rule for every status pair", async () => {
      for (const from of REACHABLE) {
        for (const to of BOOKING_STATUSES) {
          const booking = await bookingIn(from);
          const withReason = await opsClient.rpc("change_booking_status", {
            p_booking_id: booking.id,
            p_to_status: to,
            p_reason: "drift probe",
          });
          const allowed = (getAllowedManualTransitions(from) as string[]).includes(to);

          expect(withReason.error === null, `${from} -> ${to}`).toBe(allowed);

          if (allowed) {
            const again = await bookingIn(from);
            const noReason = await opsClient.rpc("change_booking_status", {
              p_booking_id: again.id,
              p_to_status: to,
            });
            expect(noReason.error === null, `${from} -> ${to} without reason`).toBe(
              !isReasonRequired(to),
            );
          }
        }
      }
    }, 120_000);

    it("matches the TypeScript editable and active-status rules", async () => {
      for (const status of REACHABLE) {
        const seat = await newSeat();
        const booking = await bookingIn(status, {
          p_assigned_seat_id: seat,
          p_pickup_at: T(10),
          p_return_at: T(12),
        });

        const { data: fresh } = await service
          .from("bookings")
          .select("updated_at")
          .eq("id", booking.id)
          .single();
        const update = await opsClient.rpc("update_booking", {
          p_booking_id: booking.id,
          p_expected_updated_at: fresh!.updated_at,
          p_pickup_at: booking.pickup_at,
          p_return_at: booking.return_at,
          p_assigned_seat_id: seat,
        });
        expect(update.error === null, `editable: ${status}`).toBe(
          isBookingEditable(status),
        );

        const overlap = await createAs(opsClient, {
          p_assigned_seat_id: seat,
          p_pickup_at: T(11),
          p_return_at: T(13),
        });
        const holdsSeat = (ACTIVE_BOOKING_STATUSES as readonly string[]).includes(status);
        expect(overlap.error?.code === "BK002", `active: ${status}`).toBe(holdsSeat);
      }
    }, 120_000);

    // ----- booking_events is server-written and append-only -----------------

    it("denies direct INSERT into booking_events for every client role", async () => {
      const booking = await createOk();
      const row = { booking_id: booking.id, to_status: "confirmed" as const };

      for (const client of [adminClient, opsClient, technicianClient, partnerAClient]) {
        const { error } = await client.from("booking_events").insert(row);
        expect(error).not.toBeNull();
      }
      expect(await eventsOf(booking.id)).toHaveLength(1);
    });

    it("denies UPDATE and DELETE on booking_events, even for the service role", async () => {
      const booking = await createOk();

      const update = await service
        .from("booking_events")
        .update({ notes: "tampered" })
        .eq("booking_id", booking.id)
        .select();
      expect(update.error?.code).toBe("55000");

      const del = await service.from("booking_events").delete().eq("booking_id", booking.id);
      expect(del.error?.code).toBe("55000");

      const userUpdate = await opsClient
        .from("booking_events")
        .update({ notes: "tampered" })
        .eq("booking_id", booking.id)
        .select();
      expect(userUpdate.data ?? []).toEqual([]);
    });

    it("lets a referenced seat be deleted (FK SET NULL is not blocked by the guards)", async () => {
      const seat = await newSeat();
      const booking = await createOk({ p_assigned_seat_id: seat, p_pickup_at: T(5), p_return_at: T(6) });

      await service.from("seat_status_history").delete().eq("seat_id", seat);
      const { error } = await service.from("seats").delete().eq("id", seat);
      expect(error).toBeNull();

      const { data } = await service.from("bookings").select("assigned_seat_id").eq("id", booking.id).single();
      expect(data?.assigned_seat_id).toBeNull();
    });

    // ----- List filtering at the database level (QA) ------------------------

    it("filters the booking list by status, partner, airport, booking number and pickup range in the database", async () => {
      const a = await createOk({ p_partner_id: PARTNER_A_ID, p_pickup_at: T(20), p_return_at: T(21) });
      const b = await createOk({ p_partner_id: PARTNER_B_ID, p_pickup_at: T(25), p_return_at: T(26) });
      const { error: cancelError } = await opsClient.rpc("change_booking_status", {
        p_booking_id: b.id,
        p_to_status: "cancelled",
        p_reason: "filter test",
      });
      expect(cancelError).toBeNull();

      const ids = async (
        q: PromiseLike<{ data: { id: string }[] | null; error: unknown }>,
      ) => {
        const { data, error } = await q;
        expect(error).toBeNull();
        return (data ?? []).map((r) => r.id);
      };

      const byStatus = await ids(
        opsClient.from("bookings").select("id").eq("status", "cancelled").in("id", [a.id, b.id]),
      );
      expect(byStatus).toEqual([b.id]);

      const byPartner = await ids(
        opsClient.from("bookings").select("id").eq("partner_id", PARTNER_A_ID).in("id", [a.id, b.id]),
      );
      expect(byPartner).toEqual([a.id]);

      const byAirport = await ids(
        opsClient.from("bookings").select("id").eq("airport_id", otherAirportId).in("id", [a.id, b.id]),
      );
      expect(byAirport).toEqual([]);

      const byNumber = await ids(
        opsClient.from("bookings").select("id").ilike("booking_number", a.booking_number),
      );
      expect(byNumber).toEqual([a.id]);

      const byRange = await ids(
        opsClient
          .from("bookings")
          .select("id")
          .gte("pickup_at", T(24, 0))
          .lte("pickup_at", T(26, 0))
          .in("id", [a.id, b.id]),
      );
      expect(byRange).toEqual([b.id]);
    });

    it("returns zero rows when a partner_user filters by another partner's id (filter cannot widen RLS)", async () => {
      const b = await createOk({ p_partner_id: PARTNER_B_ID, p_pickup_at: T(27), p_return_at: T(28) });
      const { data, error } = await partnerAClient
        .from("bookings")
        .select("id")
        .eq("partner_id", PARTNER_B_ID)
        .eq("id", b.id);
      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    // ----- Seat/booking consistency (QA) --------------------------------------

    it("keeps the assigned seat on a booking when the seat is later quarantined, and rejects new bookings on it (BK001)", async () => {
      const seat = await newSeat();
      const booking = await createOk({
        p_assigned_seat_id: seat,
        p_pickup_at: T(14),
        p_return_at: T(15),
      });

      const { error } = await opsClient.rpc("change_seat_status", {
        p_seat_id: seat,
        p_to_status: "quarantine",
        p_reason: "consistency test",
      });
      expect(error).toBeNull();

      const { data: still } = await opsClient
        .from("bookings")
        .select("assigned_seat_id, status")
        .eq("id", booking.id)
        .single();
      expect(still).toMatchObject({ assigned_seat_id: seat, status: "pending" });

      const blocked = await createAs(opsClient, {
        p_assigned_seat_id: seat,
        p_pickup_at: T(16),
        p_return_at: T(17),
      });
      expect(blocked.error?.code).toBe("BK001");
    });

    // ----- Regression -------------------------------------------------------

    it("keeps seeded bookings readable and their notes editable, and F09 change_seat_status working", async () => {
      const { count } = await adminClient.from("bookings").select("id", { count: "exact", head: true });
      expect(count).toBeGreaterThanOrEqual(20);

      const { data: seeded } = await adminClient
        .from("bookings")
        .select("booking_number")
        .eq("id", BOOKING_A_ID)
        .single();
      expect(seeded?.booking_number).toBe("BK-00002");

      const { error } = await opsClient.from("bookings").update({ notes: `seed note ${uniq()}` }).eq("id", BOOKING_A_ID);
      expect(error).toBeNull();

      const seat = await newSeat();
      const { error: seatError } = await opsClient.rpc("change_seat_status", {
        p_seat_id: seat,
        p_to_status: "quarantine",
        p_reason: "regression",
      });
      expect(seatError).toBeNull();
    });
  });
});
