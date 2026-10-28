import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePartnerScopeMock = vi.hoisted(() => vi.fn());
const getSummaryMock = vi.hoisted(() => vi.fn());
const getUpcomingMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({
  requirePartnerScope: requirePartnerScopeMock,
}));

vi.mock("@/features/partners/lib/get-partner-summary", () => ({
  getPartnerSummary: getSummaryMock,
}));

vi.mock("@/features/partners/lib/get-upcoming-partner-rentals", () => ({
  getUpcomingPartnerRentals: getUpcomingMock,
}));

import PartnerPage from "@/app/(partner)/partner/page";

const USER = {
  id: "user-1",
  email: "partner@example.com",
  full_name: "Partner User",
  role: "partner_user" as const,
  partner_id: "partner-a",
  is_active: true,
};

async function render() {
  return renderToStaticMarkup(await PartnerPage());
}

describe("PartnerPage", () => {
  beforeEach(() => {
    requirePartnerScopeMock.mockReset();
    requirePartnerScopeMock.mockResolvedValue(USER);
    getSummaryMock.mockReset();
    getSummaryMock.mockResolvedValue({ name: "ERAC Rentals", code: "ERAC" });
    getUpcomingMock.mockReset();
    getUpcomingMock.mockResolvedValue([]);
  });

  it("should guard the page with bookings:view_own_partner (defense-in-depth alongside the layout)", async () => {
    await render();

    expect(requirePartnerScopeMock).toHaveBeenCalledWith(
      "bookings:view_own_partner",
    );
  });

  it("should propagate the guard's redirect without reading anything", async () => {
    requirePartnerScopeMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(render()).rejects.toThrow("REDIRECT:/forbidden");
    expect(getSummaryMock).not.toHaveBeenCalled();
    expect(getUpcomingMock).not.toHaveBeenCalled();
  });

  it("should show the Partner Overview with the partner's name and code, and never its raw id", async () => {
    const html = await render();

    expect(html).toContain("Partner Overview");
    expect(html).toContain("ERAC Rentals");
    expect(html).toContain("ERAC");
    expect(html).toContain("Your partner data only");
    expect(html).not.toContain("partner-a");
  });

  it("should read the partner of the signed-in user only", async () => {
    await render();

    expect(getSummaryMock).toHaveBeenCalledWith("partner-a");
  });

  it("should show the sections of the design and nothing that is not in it", async () => {
    const html = await render();

    for (const text of [
      "Rentals today",
      "Revenue and invoices",
      "Launch credit",
      "Upcoming partner rentals",
    ]) {
      expect(html).toContain(text);
    }
    expect(html).not.toContain("All counts");
    expect(html).not.toContain("Not available yet");
  });

  it("should say the partner could not be found, not show the overview, when the partner row is not visible", async () => {
    getSummaryMock.mockResolvedValue(null);

    const html = await render();

    expect(html).toContain("Your partner could not be found");
    expect(html).not.toContain("Revenue and invoices");
  });

  it("should let a failed partner read reach the error boundary", async () => {
    getSummaryMock.mockRejectedValue(new Error("Could not read the partner"));

    await expect(render()).rejects.toThrow("Could not read the partner");
  });
});
