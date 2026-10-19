import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAnyPermissionMock = vi.hoisted(() => vi.fn());
const getJobOptionsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({
  requireAnyPermission: requireAnyPermissionMock,
}));

vi.mock("@/features/incidents/lib/get-incident-job-options", () => ({
  getIncidentJobOptions: getJobOptionsMock,
}));

// Client component that needs the router and a Server Action.
vi.mock("@/features/incidents/components/incident-report-form", () => ({
  IncidentReportForm: () => null,
}));

import NewIncidentPage from "@/app/(dashboard)/incidents/new/page";

const JOBS = [
  { id: "j-1", job_type: "inspection", booking_number: "BK-00002" },
];

async function element(params: Record<string, string> = {}) {
  return NewIncidentPage({ searchParams: Promise.resolve(params) });
}

describe("NewIncidentPage", () => {
  beforeEach(() => {
    requireAnyPermissionMock.mockReset();
    requireAnyPermissionMock.mockResolvedValue({ id: "u-1", role: "admin" });
    getJobOptionsMock.mockReset();
    getJobOptionsMock.mockResolvedValue(JOBS);
  });

  it("should guard the page with the report permissions", async () => {
    await element();

    expect(requireAnyPermissionMock).toHaveBeenCalledWith([
      "incidents:report",
      "incidents:view",
    ]);
  });

  it("should propagate the guard's redirect without loading the jobs", async () => {
    requireAnyPermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(element()).rejects.toThrow("REDIRECT:/forbidden");
    expect(getJobOptionsMock).not.toHaveBeenCalled();
  });

  it("should render the report form under its title", async () => {
    const html = renderToStaticMarkup(await element());

    expect(html).toContain("Report incident");
  });

  function formProps(node: Awaited<ReturnType<typeof element>>) {
    // The form sits in the page's second child div.
    const container = (node.props.children as unknown[])[1] as {
      props: { children: { props: Record<string, unknown> } };
    };
    return container.props.children.props;
  }

  it("should select the job from the url when the user can report on it", async () => {
    expect(formProps(await element({ job_id: "j-1" })).initialJobId).toBe("j-1");
  });

  it.each([["j-unknown"], [""]])(
    "should not select a job that is not among the user's jobs (%j)",
    async (job_id) => {
      expect(formProps(await element({ job_id })).initialJobId).toBe("");
    },
  );

  it("should send Cancel to the incident list for a manager and to the jobs for a technician", async () => {
    expect(formProps(await element()).cancelHref).toBe("/incidents");

    requireAnyPermissionMock.mockResolvedValue({ id: "t-1", role: "technician" });
    expect(formProps(await element()).cancelHref).toBe("/jobs");
  });
});
