import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAnyPermissionMock = vi.hoisted(() => vi.fn());
const getIncidentsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({
  requireAnyPermission: requireAnyPermissionMock,
}));

vi.mock("@/features/incidents/lib/get-incidents", () => ({
  getIncidents: getIncidentsMock,
}));

// Client component that needs the app router; irrelevant to these assertions.
vi.mock("@/features/incidents/components/incidents-filters", () => ({
  IncidentsFilters: () => null,
}));

import IncidentsPage from "@/app/(dashboard)/incidents/page";
import { INCIDENT_SEARCH_TOO_LONG_MESSAGE } from "@/features/incidents/lib/incident-search";

const INCIDENT = {
  id: "i-1",
  type: "Damaged strap",
  severity: "high",
  status: "open",
  description: "The harness strap is torn.",
  created_at: "2026-10-16T08:05:00Z",
  seat: { serial_number: "SN-2" },
  booking: null,
  reporter: { full_name: "Ahmed" },
};

async function render(params: Record<string, string> = {}) {
  return renderToStaticMarkup(
    await IncidentsPage({ searchParams: Promise.resolve(params) }),
  );
}

describe("IncidentsPage", () => {
  beforeEach(() => {
    requireAnyPermissionMock.mockReset();
    requireAnyPermissionMock.mockResolvedValue({ id: "u-1", role: "admin" });
    getIncidentsMock.mockReset();
    getIncidentsMock.mockResolvedValue({ incidents: [INCIDENT], total: 1 });
  });

  it("should guard the page with the incident access permissions", async () => {
    await render();

    expect(requireAnyPermissionMock).toHaveBeenCalledWith([
      "incidents:view",
      "operations:view_own_partner",
      "incidents:report",
    ]);
  });

  it("should propagate the guard's redirect without loading data", async () => {
    requireAnyPermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(render()).rejects.toThrow("REDIRECT:/forbidden");
    expect(getIncidentsMock).not.toHaveBeenCalled();
  });

  it("should offer Report incident, linking to the report form", async () => {
    const html = await render();

    expect(html).toContain("Report incident");
    expect(html).toContain('href="/incidents/new"');
  });

  it("should not offer Report incident to a partner user, who only reads", async () => {
    requireAnyPermissionMock.mockResolvedValue({ id: "p-1", role: "partner_user" });

    const html = await render();

    expect(html).toContain("Damaged strap");
    expect(html).not.toContain("Report incident");
  });

  it("should offer Report incident to a technician", async () => {
    requireAnyPermissionMock.mockResolvedValue({ id: "t-1", role: "technician" });

    expect(await render()).toContain("Report incident");
  });

  it("should list the incidents with a link to the detail of each", async () => {
    const html = await render();

    expect(html).toContain("Damaged strap");
    expect(html).toContain('href="/incidents/i-1"');
    expect(html).toContain("High");
    expect(html).toContain("Open");
    expect(html).toContain("SN-2");
    expect(html).toContain("Ahmed");
    expect(html).toContain("Page 1 of 1 (1 incident)");
  });

  it("should show the empty state when there are no incidents", async () => {
    getIncidentsMock.mockResolvedValue({ incidents: [], total: 0 });

    const html = await render();

    expect(html).toContain("No incidents yet.");
    expect(html).not.toContain("<table");
  });

  it("should show the no-match empty state when a search finds nothing", async () => {
    getIncidentsMock.mockResolvedValue({ incidents: [], total: 0 });

    const html = await render({ q: "nothing" });

    expect(html).toContain("No incidents match the search or filters.");
    expect(getIncidentsMock).toHaveBeenCalledWith(
      expect.objectContaining({ q: "nothing" }),
    );
  });

  it("should load only the incidents of the chosen status and severity", async () => {
    await render({ status: "open", severity: "high" });

    expect(getIncidentsMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "open", severity: "high" }),
    );
  });

  it("should combine the filters with the search", async () => {
    await render({ q: "strap", status: "investigating" });

    expect(getIncidentsMock).toHaveBeenCalledWith(
      expect.objectContaining({ q: "strap", status: "investigating" }),
    );
  });

  it("should ignore a status or severity that is not in the enum", async () => {
    await render({ status: "OPEN", severity: "urgent" });

    expect(getIncidentsMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: undefined, severity: undefined }),
    );
  });

  it.each([[{ status: "closed" }], [{ severity: "low" }]])(
    "should show the no-match empty state when the filter %j finds nothing",
    async (params) => {
      getIncidentsMock.mockResolvedValue({ incidents: [], total: 0 });

      const html = await render(params);

      expect(html).toContain("No incidents match the search or filters.");
    },
  );

  it("should say the search was not applied when it is too long", async () => {
    const html = await render({ q: "x".repeat(101) });

    expect(html).toContain("Search not applied");
    expect(html).toContain(INCIDENT_SEARCH_TOO_LONG_MESSAGE);
    expect(getIncidentsMock).toHaveBeenCalledWith(
      expect.objectContaining({ q: undefined }),
    );
  });

  it("should let an error from the query reach the error boundary", async () => {
    getIncidentsMock.mockRejectedValue(new Error("db down"));

    await expect(render()).rejects.toThrow("db down");
  });
});
