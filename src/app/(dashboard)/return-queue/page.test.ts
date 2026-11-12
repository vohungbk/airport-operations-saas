import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.hoisted(() => vi.fn());
const getReturnQueueMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/features/return-queue/lib/get-return-queue", () => ({
  getReturnQueue: getReturnQueueMock,
}));

vi.mock("@/features/jobs/lib/get-job-airport-options", () => ({
  getJobAirportOptions: vi
    .fn()
    .mockResolvedValue([{ id: "a-1", code: "DXB", timezone: "Asia/Dubai" }]),
  getJobsTimeZone: () => "Asia/Dubai",
}));

// Client component that needs the router.
vi.mock("@/features/return-queue/components/return-queue-filters", () => ({
  ReturnQueueFilters: () => null,
}));

import ReturnQueuePage from "@/app/(dashboard)/return-queue/page";
import { toReturnQueueItem } from "@/features/return-queue/lib/return-queue";

const ITEM = toReturnQueueItem(
  {
    id: "b-1",
    booking_number: "BK-2026-000123",
    status: "cleaning",
    airport: { code: "DXB", timezone: "Asia/Dubai" },
    partner: { name: "Emirates Rent A Car" },
    seat: { id: "s-1", serial_number: "SEAT-0001", status: "cleaning" },
    events: [{ to_status: "returned", created_at: "2026-11-04T06:20:00Z" }],
    chain_steps: [],
  },
  new Date("2026-11-04T07:02:00Z"),
);

async function render(searchParams: Record<string, string> = {}) {
  return renderToStaticMarkup(
    await ReturnQueuePage({ searchParams: Promise.resolve(searchParams) }),
  );
}

describe("ReturnQueuePage", () => {
  beforeEach(() => {
    requirePermissionMock.mockReset();
    requirePermissionMock.mockResolvedValue({ id: "u-1", role: "admin" });
    getReturnQueueMock.mockReset();
    getReturnQueueMock.mockResolvedValue([ITEM]);
  });

  it("should guard the page with the manager permission", async () => {
    await render();

    expect(requirePermissionMock).toHaveBeenCalledWith("dashboards:view");
  });

  it("should propagate the guard's redirect without loading the queue", async () => {
    requirePermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(render()).rejects.toThrow("REDIRECT:/forbidden");
    expect(getReturnQueueMock).not.toHaveBeenCalled();
  });

  it("should list the returned seats with their step and link each seat to its chain step", async () => {
    const html = await render();

    expect(html).toContain("Return queue");
    expect(html).toContain("Admin · Full access · DXB");
    expect(html).toContain("1 seat · Updated");
    expect(html).toContain("SEAT-0001");
    expect(html).toContain("Cleaning 1");
    expect(html).toContain('href="/return-queue/b-1"');
  });

  it("should say no seats are waiting when the queue is empty", async () => {
    getReturnQueueMock.mockResolvedValue([]);

    expect(await render()).toContain("No seats waiting.");
  });

  it("should say nothing matches when the filters leave no seat", async () => {
    expect(await render({ step: "drying" })).toContain(
      "No seats match the search or filters.",
    );
  });
});
