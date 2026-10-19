import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

import {
  getIncidentById,
  INCIDENT_DETAIL_SELECT,
} from "@/features/incidents/lib/get-incident-by-id";

const INCIDENT_ID = "c0000000-0000-0000-0000-000000000001";

function mockQuery(result: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  createClientMock.mockResolvedValue({ from });
  return { from, select, eq, maybeSingle };
}

describe("getIncidentById", () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it.each([[""], ["not-an-id"], ["1; drop table incidents"]])(
    "should return null without querying when the id %j is malformed",
    async (id) => {
      await expect(getIncidentById(id)).resolves.toBeNull();
      expect(createClientMock).not.toHaveBeenCalled();
    },
  );

  it("should return null when RLS hides the incident or it does not exist", async () => {
    mockQuery({ data: null, error: null });

    await expect(getIncidentById(INCIDENT_ID)).resolves.toBeNull();
  });

  it("should read the incident table by id with the explicit column list", async () => {
    const { from, select, eq } = mockQuery({
      data: { id: INCIDENT_ID, type: "Damaged strap" },
      error: null,
    });

    await expect(getIncidentById(INCIDENT_ID)).resolves.toEqual({
      id: INCIDENT_ID,
      type: "Damaged strap",
    });
    expect(from).toHaveBeenCalledWith("incidents");
    expect(select).toHaveBeenCalledWith(INCIDENT_DETAIL_SELECT);
    expect(eq).toHaveBeenCalledWith("id", INCIDENT_ID);
  });

  it("should not select user emails or partner contact and commercial data", () => {
    expect(INCIDENT_DETAIL_SELECT).not.toMatch(/email|phone|contact|share|rate/);
  });

  it("should throw when the query fails", async () => {
    mockQuery({ data: null, error: new Error("db down") });

    await expect(getIncidentById(INCIDENT_ID)).rejects.toThrow("db down");
  });
});
