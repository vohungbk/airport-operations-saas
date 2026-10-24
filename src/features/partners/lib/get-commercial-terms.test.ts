import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

import {
  COMMERCIAL_TERMS_SELECT,
  getCommercialTerms,
} from "@/features/partners/lib/get-commercial-terms";

const PARTNER_ID = "a0000000-0000-0000-0000-000000000001";

function mockQuery(result: { data: unknown; error: unknown }) {
  const limit = vi.fn().mockResolvedValue(result);
  const order = vi.fn(() => ({ limit }));
  const eq = vi.fn(() => ({ order }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  createClientMock.mockResolvedValue({ from });
  return { from, select, eq, order, limit };
}

describe("getCommercialTerms", () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it("should return an empty list without querying when the id is malformed", async () => {
    await expect(getCommercialTerms("not-an-id")).resolves.toEqual([]);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("should ask for the versions of one partner, newest first, in one query", async () => {
    const q = mockQuery({ data: [], error: null });

    await getCommercialTerms(PARTNER_ID);

    expect(q.from).toHaveBeenCalledWith("partner_commercial_terms");
    expect(q.select).toHaveBeenCalledWith(COMMERCIAL_TERMS_SELECT);
    expect(q.eq).toHaveBeenCalledWith("partner_id", PARTNER_ID);
    expect(q.order).toHaveBeenCalledWith("effective_from", { ascending: false });
  });

  it("should return no versions for a partner with none, or when RLS hides them", async () => {
    mockQuery({ data: null, error: null });

    await expect(getCommercialTerms(PARTNER_ID)).resolves.toEqual([]);
  });

  it("should return the rows", async () => {
    const rows = [{ id: "t-1", partner_share_percent: 30 }];
    mockQuery({ data: rows, error: null });

    await expect(getCommercialTerms(PARTNER_ID)).resolves.toEqual(rows);
  });

  it("should throw when the query fails", async () => {
    mockQuery({ data: null, error: new Error("db down") });

    await expect(getCommercialTerms(PARTNER_ID)).rejects.toThrow("db down");
  });

  it("should select the terms but not the launch credit balance or the partner's private data", () => {
    for (const column of ["launch_credit_accumulated", "launch_mode", "contact_email", "partner_id"]) {
      expect(COMMERCIAL_TERMS_SELECT).not.toContain(column);
    }
  });
});
