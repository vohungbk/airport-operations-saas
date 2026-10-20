import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAnyPermissionMock = vi.hoisted(() => vi.fn());
const getIncidentByIdMock = vi.hoisted(() => vi.fn());
const getHistoryMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({
  requireAnyPermission: requireAnyPermissionMock,
}));

vi.mock("@/features/incidents/lib/get-incident-by-id", () => ({
  getIncidentById: getIncidentByIdMock,
}));

vi.mock("@/features/incidents/lib/get-incident-history", () => ({
  getIncidentHistory: getHistoryMock,
  INCIDENT_HISTORY_LIMIT: 50,
}));

// Client component that needs the router and a Server Action.
vi.mock(
  "@/features/incidents/components/change-incident-status-dialog",
  async () => {
    const { createElement } = await import("react");

    return {
      ChangeIncidentStatusDialog: ({
        allowedStatuses,
      }: {
        allowedStatuses: string[];
      }) => createElement("span", null, `DIALOG:${allowedStatuses.join(",")}`),
    };
  },
);

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
    getHistoryMock.mockReset();
    getHistoryMock.mockResolvedValue({ history: [], truncated: false });
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

  it.each([
    ["open", "investigating,resolved"],
    ["investigating", "resolved"],
    ["resolved", "closed,investigating"],
  ])(
    "should offer the permitted transitions of an incident that is %s",
    async (status, targets) => {
      getIncidentByIdMock.mockResolvedValue({ ...INCIDENT, status });

      expect(await render()).toContain(`DIALOG:${targets}`);
    },
  );

  it("should not offer a status change for a closed incident", async () => {
    getIncidentByIdMock.mockResolvedValue({ ...INCIDENT, status: "closed" });

    expect(await render()).not.toContain("DIALOG:");
  });

  it("should show the history of the incident", async () => {
    getHistoryMock.mockResolvedValue({
      history: [
        {
          id: "h-1",
          from_status: "open",
          to_status: "investigating",
          notes: "Looking into it",
          created_at: "2026-10-17T09:00:00Z",
          actor_name: "Fatima",
        },
      ],
      truncated: false,
    });

    const html = await render();

    expect(getHistoryMock).toHaveBeenCalledWith("i-1");
    expect(html).toContain("Looking into it");
    expect(html).toContain("Fatima");
  });

  it("should not show the history or the control when the incident is not within scope", async () => {
    getIncidentByIdMock.mockResolvedValue(null);

    const html = await render();

    expect(html).not.toContain("DIALOG:");
    expect(html).not.toContain("History");
  });

  it("should let an error from the query reach the error boundary", async () => {
    getIncidentByIdMock.mockRejectedValue(new Error("db down"));

    await expect(render()).rejects.toThrow("db down");
  });
});
