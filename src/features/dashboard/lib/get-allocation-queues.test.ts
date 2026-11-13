import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

import { getAllocationQueues, toAllocationQueues } from "@/features/dashboard/lib/get-allocation-queues";

const row = (overrides: Record<string, unknown> = {}) => ({
  queue: "allocation",
  total: 3,
  item_id: "bk-1",
  title: "BK-2026-000131",
  detail: "Infant Carrier",
  status: "pending",
  due_at: null,
  timezone: null,
  ...overrides,
});

describe("toAllocationQueues", () => {
  it("should give each queue its count, its next item and the status in the words of the design", () => {
    const queues = toAllocationQueues([
      row(),
      row({
        queue: "installations",
        total: 2,
        item_id: "job-1",
        title: "Omar Haddad",
        detail: "Bay C-14",
        status: "assigned",
        due_at: "2026-10-24T11:15:00Z",
        timezone: "Asia/Dubai",
      }),
      row({ queue: "cleaning", total: 1, item_id: "seat-1", title: "SEAT-0018", detail: "Infant", status: "cleaning" }),
      row({ queue: "inspection", total: 4, item_id: "seat-2", title: "SEAT-0024", detail: "Toddler", status: "inspection" }),
    ]);

    expect(queues.allocation).toEqual({
      count: 3,
      next: { href: "/bookings/bk-1", label: "BK-2026-000131 · Infant Carrier", status_label: "New" },
    });
    expect(queues.installations).toEqual({
      count: 2,
      next: { href: "/jobs/job-1", label: "Omar Haddad · Bay C-14 · 15:15 GST", status_label: "Assigned" },
    });
    expect(queues.cleaning.next).toMatchObject({ href: "/seats/seat-1", status_label: "Cleaning" });
    expect(queues.inspection).toMatchObject({ count: 4, next: { href: "/seats/seat-2", status_label: "Inspection" } });
  });

  it("should give a count of 0 and no next item to a queue that has no row", () => {
    const queues = toAllocationQueues([row()]);

    expect(queues.installations).toEqual({ count: 0, next: null });
    expect(queues.cleaning).toEqual({ count: 0, next: null });
  });

  it("should leave out the missing parts of the next item instead of printing them", () => {
    const queues = toAllocationQueues([row({ queue: "installations", title: "JOB-0001", detail: null })]);

    expect(queues.installations.next?.label).toBe("JOB-0001");
  });
});

describe("getAllocationQueues (VI-F11-S03, AC01)", () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it("should read the queues as the signed-in user", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [row()], error: null });
    createClientMock.mockResolvedValue({ rpc });

    const queues = await getAllocationQueues();

    expect(rpc).toHaveBeenCalledWith("command_centre_allocation_queues");
    expect(queues?.allocation.count).toBe(3);
  });

  it.each([
    ["the read returns an error", () => createClientMock.mockResolvedValue({ rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "x" } }) })],
    ["the client cannot be created", () => createClientMock.mockRejectedValue(new Error("no session"))],
  ])("should give null, not zero counts, when %s", async (_name, arrange) => {
    arrange();

    expect(await getAllocationQueues()).toBeNull();
  });
});
