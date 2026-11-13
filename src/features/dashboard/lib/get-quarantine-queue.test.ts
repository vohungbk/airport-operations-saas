import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

import { getQuarantineQueue, toQuarantineQueue } from "@/features/dashboard/lib/get-quarantine-queue";

const row = (overrides: Record<string, unknown> = {}) => ({
  queue: "quarantine",
  total: 2,
  item_id: "seat-7",
  title: "SEAT-0007",
  detail: "Infant",
  status: "quarantine",
  ...overrides,
});

describe("toQuarantineQueue", () => {
  it("should give the count, a link to the seat and the status in the words of the design", () => {
    expect(toQuarantineQueue([row()])).toEqual({
      count: 2,
      next: { href: "/seats/seat-7", label: "SEAT-0007 · Infant", status_label: "Quarantine" },
    });
  });

  it("should give a count of 0 and no next item when no seat is in quarantine", () => {
    expect(toQuarantineQueue([])).toEqual({ count: 0, next: null });
  });
});

describe("getQuarantineQueue (VI-F11-S05, AC01)", () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it("should read the queue as the signed-in user", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [row()], error: null });
    createClientMock.mockResolvedValue({ rpc });

    const queue = await getQuarantineQueue();

    expect(rpc).toHaveBeenCalledWith("command_centre_quarantine_queue");
    expect(queue?.count).toBe(2);
  });

  it.each([
    ["the read returns an error", () => createClientMock.mockResolvedValue({ rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "x" } }) })],
    ["the client cannot be created", () => createClientMock.mockRejectedValue(new Error("no session"))],
  ])("should give null, not a zero count, when %s", async (_name, arrange) => {
    arrange();

    expect(await getQuarantineQueue()).toBeNull();
  });
});
