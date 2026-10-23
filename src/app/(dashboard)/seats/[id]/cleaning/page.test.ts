import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAnyPermissionMock = vi.hoisted(() => vi.fn());
const getJobsMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() =>
  vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
);

vi.mock("@/lib/auth/current-user", () => ({
  requireAnyPermission: requireAnyPermissionMock,
}));

vi.mock("@/features/cleaning/lib/get-cleaning-jobs-for-seat", () => ({
  getCleaningJobsForSeat: getJobsMock,
}));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));

import SeatCleaningPage from "@/app/(dashboard)/seats/[id]/cleaning/page";

const SEAT_ID = "e0000000-0000-0000-0000-000000000008";
const render = async () =>
  renderToStaticMarkup(
    await SeatCleaningPage({ params: Promise.resolve({ id: SEAT_ID }) }),
  );

/**
 * FO-F03-S11: a scan only leads to the cleaning panel. Nothing here starts or completes
 * a cleaning (AC02), and a person without the permission is refused first (AC04).
 */
describe("SeatCleaningPage", () => {
  beforeEach(() => {
    requireAnyPermissionMock.mockReset();
    requireAnyPermissionMock.mockResolvedValue({ id: "t-1", role: "technician" });
    getJobsMock.mockReset();
    redirectMock.mockClear();
  });

  it("should open the cleaning panel of the only open job of the seat (AC01)", async () => {
    getJobsMock.mockResolvedValue([{ id: "j-1", status: "assigned", assigned_at: "x", booking_number: "BK-1" }]);

    await expect(render()).rejects.toThrow("REDIRECT:/jobs/j-1/cleaning");
    expect(getJobsMock).toHaveBeenCalledWith(SEAT_ID);
  });

  it("should list the jobs, and not choose one, when the seat has several", async () => {
    getJobsMock.mockResolvedValue([
      { id: "j-1", status: "assigned", assigned_at: "x", booking_number: "BK-1" },
      { id: "j-2", status: "in_progress", assigned_at: "y", booking_number: "BK-2" },
    ]);

    const html = await render();

    expect(redirectMock).not.toHaveBeenCalled();
    expect(html).toContain('href="/jobs/j-1/cleaning"');
    expect(html).toContain('href="/jobs/j-2/cleaning"');
  });

  it("should show the same refusal for a seat with no job of the user as for an unknown seat", async () => {
    getJobsMock.mockResolvedValue([]);

    const html = await render();

    expect(html).toContain("You cannot clean this seat");
    expect(html).toContain('href="/jobs"');
  });

  it("should refuse a person without the cleaning permission before any query (AC04)", async () => {
    requireAnyPermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(render()).rejects.toThrow("REDIRECT:/forbidden");
    expect(getJobsMock).not.toHaveBeenCalled();
  });

  it("should not import an action that starts or completes a cleaning (AC02)", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync("src/app/(dashboard)/seats/[id]/cleaning/page.tsx", "utf8");

    expect(source).not.toMatch(/start-cleaning|complete-cleaning|start_cleaning|complete_cleaning/);
  });
});
