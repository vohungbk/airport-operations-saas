import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

import { getJobById, JOB_DETAIL_SELECT } from "@/features/jobs/lib/get-job-by-id";

const JOB_ID = "e0000000-0000-0000-0000-000000000001";

function mockQuery(result: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  createClientMock.mockResolvedValue({ from });
  return { from, select, eq, maybeSingle };
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
});
