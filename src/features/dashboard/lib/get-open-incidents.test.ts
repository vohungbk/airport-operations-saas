import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

import { getOpenIncidents, toOpenIncidentList } from "@/features/dashboard/lib/get-open-incidents";

const row = (overrides: Record<string, unknown> = {}) => ({
  id: "inc-1",
  type: "Damaged seat",
  severity: "critical",
  status: "open",
  ...overrides,
});

function mockRequest(result: { data: unknown; count: number | null; error: unknown }) {
  const request = {
    eq: vi.fn(() => request),
    order: vi.fn(() => request),
    limit: vi.fn(() => request),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  createClientMock.mockResolvedValue({ from: vi.fn(() => ({ select: vi.fn(() => request) })) });
  return request;
}

describe("toOpenIncidentList", () => {
  it("should give a link to the incident, its type with severity and the status", () => {
    expect(toOpenIncidentList([row()], 1)).toEqual({
      count: 1,
      items: [
        { id: "inc-1", href: "/incidents/inc-1", label: "Damaged seat · Critical", status_label: "Open" },
      ],
    });
  });

  it("should give an empty list with a count of 0 when no incident is open", () => {
    expect(toOpenIncidentList([], 0)).toEqual({ count: 0, items: [] });
  });
});

describe("getOpenIncidents (VI-F11-S08, AC01)", () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it("should read the open incidents, the most severe first, five at most", async () => {
    const request = mockRequest({ data: [row()], count: 7, error: null });

    const list = await getOpenIncidents();

    expect(request.eq).toHaveBeenCalledWith("status", "open");
    expect(request.order).toHaveBeenCalledWith("severity", { ascending: false });
    expect(request.limit).toHaveBeenCalledWith(5);
    expect(list?.count).toBe(7);
  });

  it.each([
    ["the read returns an error", () => mockRequest({ data: null, count: null, error: { message: "x" } })],
    ["the client cannot be created", () => createClientMock.mockRejectedValue(new Error("no session"))],
  ])("should give null, not an empty list, when %s", async (_name, arrange) => {
    arrange();

    await expect(getOpenIncidents()).resolves.toBeNull();
  });
});
