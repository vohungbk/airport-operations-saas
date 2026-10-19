import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAnyPermissionMock = vi.hoisted(() => vi.fn());
const getIncidentByIdMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({
  requireAnyPermission: requireAnyPermissionMock,
}));

vi.mock("@/features/incidents/lib/get-incident-by-id", () => ({
  getIncidentById: getIncidentByIdMock,
}));

import IncidentDetailPage from "@/app/(dashboard)/incidents/[id]/page";

const INCIDENT = {
  id: "i-1",
  type: "Damaged strap",
  severity: "high",
  status: "open",
  description: "The harness strap is torn.",
  created_at: "2026-10-16T08:05:00Z",
  updated_at: "2026-10-16T08:05:00Z",
  resolved_at: null,
  technician_job_id: null,
  partner: { name: "Emirates Rent A Car" },
  seat: { serial_number: "SN-2" },
  booking: { booking_number: "BK-00002" },
  reporter: { full_name: "Ahmed" },
  resolver: null,
};

async function render(id = "i-1") {
  return renderToStaticMarkup(
    await IncidentDetailPage({ params: Promise.resolve({ id }) }),
  );
}

describe("IncidentDetailPage", () => {
  beforeEach(() => {
    requireAnyPermissionMock.mockReset();
    requireAnyPermissionMock.mockResolvedValue({ id: "u-1", role: "admin" });
    getIncidentByIdMock.mockReset();
    getIncidentByIdMock.mockResolvedValue(INCIDENT);
  });

  it("should guard the page with incidents:view", async () => {
    await render();

    expect(requireAnyPermissionMock).toHaveBeenCalledWith(["incidents:view"]);
  });

  it("should propagate the guard's redirect without loading the incident", async () => {
    requireAnyPermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(render()).rejects.toThrow("REDIRECT:/forbidden");
    expect(getIncidentByIdMock).not.toHaveBeenCalled();
  });

  it("should show the incident for the id in the url", async () => {
    const html = await render("i-1");

    expect(getIncidentByIdMock).toHaveBeenCalledWith("i-1");
    expect(html).toContain("Damaged strap");
    expect(html).toContain("Emirates Rent A Car");
    expect(html).toContain('href="/incidents"');
  });

  it("should show the forbidden state, with no incident details, when the incident is not within scope", async () => {
    getIncidentByIdMock.mockResolvedValue(null);

    const html = await render("other");

    expect(html).toContain("You cannot view this incident");
    expect(html).toContain("not found or is not within your access");
    expect(html).toContain('href="/incidents"');
    expect(html).not.toContain("Damaged strap");
    expect(html).not.toContain("Emirates Rent A Car");
  });

  it("should let an error from the query reach the error boundary", async () => {
    getIncidentByIdMock.mockRejectedValue(new Error("db down"));

    await expect(render()).rejects.toThrow("db down");
  });
});
