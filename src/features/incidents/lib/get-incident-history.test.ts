import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

import {
  getIncidentHistory,
  INCIDENT_HISTORY_LIMIT,
  INCIDENT_HISTORY_SELECT,
} from "@/features/incidents/lib/get-incident-history";

const INCIDENT_ID = "c0000000-0000-0000-0000-000000000001";

function mockQuery(result: { data: unknown; error: unknown }) {
  const limit = vi.fn().mockResolvedValue(result);
  const order2 = vi.fn(() => ({ limit }));
  const order1 = vi.fn(() => ({ order: order2 }));
  const eq = vi.fn(() => ({ order: order1 }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  createClientMock.mockResolvedValue({ from });
  return { from, select, eq, order1, limit };
}

const row = (id: string) => ({
  id,
  from_status: "open",
  to_status: "investigating",
  notes: "Looking",
  created_at: "2026-10-17T09:00:00Z",
  actor: { full_name: "Fatima" },
});

describe("getIncidentHistory", () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it("should return nothing without querying when the id is malformed", async () => {
    await expect(getIncidentHistory("nope")).resolves.toEqual({
      history: [],
      truncated: false,
    });
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("should read the history of the incident, newest first, with the actor name", async () => {
    const { from, select, eq, order1, limit } = mockQuery({
      data: [row("h-1")],
      error: null,
    });

    await expect(getIncidentHistory(INCIDENT_ID)).resolves.toEqual({
      history: [
        {
          id: "h-1",
          from_status: "open",
          to_status: "investigating",
          notes: "Looking",
          created_at: "2026-10-17T09:00:00Z",
          actor_name: "Fatima",
        },
      ],
      truncated: false,
    });
    expect(from).toHaveBeenCalledWith("incident_status_history");
    expect(select).toHaveBeenCalledWith(INCIDENT_HISTORY_SELECT);
    expect(eq).toHaveBeenCalledWith("incident_id", INCIDENT_ID);
    expect(order1).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(limit).toHaveBeenCalledWith(INCIDENT_HISTORY_LIMIT + 1);
  });

  it("should fall back when the actor name cannot be read", async () => {
    mockQuery({ data: [{ ...row("h-1"), actor: null }], error: null });

    const { history } = await getIncidentHistory(INCIDENT_ID);

    expect(history[0].actor_name).toBeNull();
  });

  it("should cut the list at the limit and say so", async () => {
    mockQuery({
      data: Array.from({ length: INCIDENT_HISTORY_LIMIT + 1 }, (_, i) =>
        row(`h-${i}`),
      ),
      error: null,
    });

    const { history, truncated } = await getIncidentHistory(INCIDENT_ID);

    expect(history).toHaveLength(INCIDENT_HISTORY_LIMIT);
    expect(truncated).toBe(true);
  });

  it("should throw when the query fails", async () => {
    mockQuery({ data: null, error: new Error("db down") });

    await expect(getIncidentHistory(INCIDENT_ID)).rejects.toThrow("db down");
  });
});
