import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

import { getActiveReturned, toActiveReturned } from "@/features/dashboard/lib/get-active-returned";

const row = (overrides: Record<string, unknown> = {}) => ({
  queue: "active",
  total: 12,
  item_id: "bk-9",
  title: "BK-2026-000140",
  detail: "Toddler Seat",
  status: "in_progress",
  ...overrides,
});

describe("toActiveReturned", () => {
  it("should give each queue its count, a link to its booking and the status in the words of the design", () => {
    const queues = toActiveReturned([
      row(),
      row({ queue: "returned", total: 2, item_id: "bk-3", title: "BK-2026-000120", status: "returned" }),
    ]);

    expect(queues.active).toEqual({
      count: 12,
      next: { href: "/bookings/bk-9", label: "BK-2026-000140 · Toddler Seat", status_label: "Active Rental" },
    });
    expect(queues.returned).toMatchObject({ count: 2, next: { href: "/bookings/bk-3", status_label: "Returned" } });
  });

  it("should give a count of 0 and no next item to a queue that has no row", () => {
    expect(toActiveReturned([row()]).returned).toEqual({ count: 0, next: null });
  });
});

describe("getActiveReturned (VI-F11-S04, AC01)", () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it("should read the queues as the signed-in user", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [row()], error: null });
    createClientMock.mockResolvedValue({ rpc });

    const queues = await getActiveReturned();

    expect(rpc).toHaveBeenCalledWith("command_centre_active_returned");
    expect(queues?.active.count).toBe(12);
  });

  it.each([
    ["the read returns an error", () => createClientMock.mockResolvedValue({ rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "x" } }) })],
    ["the client cannot be created", () => createClientMock.mockRejectedValue(new Error("no session"))],
  ])("should give null, not zero counts, when %s", async (_name, arrange) => {
    arrange();

    expect(await getActiveReturned()).toBeNull();
  });
});
