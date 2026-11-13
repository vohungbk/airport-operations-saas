import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

import { buildJobDetailSelect, getJobById, JOB_DETAIL_SELECT } from "@/features/jobs/lib/get-job-by-id";

const JOB_ID = "e0000000-0000-0000-0000-000000000001";

function mockQuery(result: { data: unknown; error: unknown }, partnerNames: { job_id: string; partner_name: string }[] = []) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  const rpc = vi.fn().mockResolvedValue({ data: partnerNames, error: null });
  createClientMock.mockResolvedValue({ from, rpc });
  return { from, select, eq, maybeSingle, rpc };
}

describe("getJobById", () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it("should return null without querying when the id is malformed", async () => {
    const result = await getJobById("not-an-id");

    expect(result).toBeNull();
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("should return null when RLS hides the job or it does not exist", async () => {
    mockQuery({ data: null, error: null });

    await expect(getJobById(JOB_ID)).resolves.toBeNull();
  });

  it("should return the job row on success", async () => {
    mockQuery({ data: { id: JOB_ID, status: "assigned" }, error: null });

    await expect(getJobById(JOB_ID)).resolves.toEqual({
      id: JOB_ID,
      status: "assigned",
    });
  });

  it("should give a technician the partner name of their own job from the function, not from the partners table", async () => {
    const { rpc, select } = mockQuery(
      { data: { id: JOB_ID, booking: { id: "b1" } }, error: null },
      [{ job_id: JOB_ID, partner_name: "Emirates Rent A Car" }],
    );

    const job = await getJobById(JOB_ID);

    expect(rpc).toHaveBeenCalledWith("technician_job_partner_names", { p_job_ids: [JOB_ID] });
    expect(job?.booking?.partner).toEqual({ name: "Emirates Rent A Car" });
    expect(select).toHaveBeenCalledWith(JOB_DETAIL_SELECT);
  });

  it("should give no partner name when the function returns none, and not call it for a manager", async () => {
    const { rpc } = mockQuery({ data: { id: JOB_ID, booking: { id: "b1" } }, error: null });

    const job = await getJobById(JOB_ID);
    await getJobById(JOB_ID, { withPartner: true });

    expect(job?.booking?.partner).toBeUndefined();
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("should throw when the query fails", async () => {
    mockQuery({ data: null, error: new Error("db down") });

    await expect(getJobById(JOB_ID)).rejects.toThrow("db down");
  });

  it("should never select pricing, revenue share, partner or free-text booking notes", () => {
    for (const column of [
      "daily_rate",
      "paid_days",
      "gross_revenue",
      "partner_share",
      "platform_share",
      "partner_id",
      "external_booking_number",
      "notes",
    ]) {
      expect(JOB_DETAIL_SELECT).not.toMatch(new RegExp(`\\b${column}\\b`));
    }
  });

  it("should select the flight of the booking, its airport time zone and the job deadline", () => {
    expect(JOB_DETAIL_SELECT.split(", ")).toContain("deadline_at");
    expect(JOB_DETAIL_SELECT).toContain("flight:flights(");
    expect(JOB_DETAIL_SELECT).toContain("airport:airports(code, name, city, timezone)");
  });

  it("should select the job number", () => {
    expect(JOB_DETAIL_SELECT.split(", ")).toContain("job_number");
  });

  it("should add the partner name only when it is asked for, for a manager", () => {
    expect(JOB_DETAIL_SELECT).not.toContain("partner:partners");
    expect(buildJobDetailSelect(false)).not.toContain("partner:partners");
    expect(buildJobDetailSelect(true)).toContain("partner:partners(name)");
  });

  it("should select the seat with its status, and the creation time of the job", () => {
    expect(JOB_DETAIL_SELECT.split(", ")).toContain("created_at");
    expect(JOB_DETAIL_SELECT).toContain("seat:seats!assigned_seat_id(id, serial_number, status,");
  });
});
