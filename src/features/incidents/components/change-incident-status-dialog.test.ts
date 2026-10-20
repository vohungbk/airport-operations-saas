import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/features/incidents/actions/change-incident-status.action", () => ({
  changeIncidentStatusAction: vi.fn(),
}));

import { ChangeIncidentStatusDialog } from "@/features/incidents/components/change-incident-status-dialog";

describe("ChangeIncidentStatusDialog", () => {
  it("should offer the Update status button", () => {
    const html = renderToStaticMarkup(
      createElement(ChangeIncidentStatusDialog, {
        incidentId: "i-1",
        incidentLabel: "Damaged strap",
        currentStatus: "open",
        allowedStatuses: ["investigating", "resolved"],
      }),
    );

    expect(html).toContain("Update status");
  });
});
