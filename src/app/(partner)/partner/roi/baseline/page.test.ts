import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePartnerScopeMock = vi.hoisted(() => vi.fn());
const getSummaryMock = vi.hoisted(() => vi.fn());
const getBaselineMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({ requirePartnerScope: requirePartnerScopeMock }));
vi.mock("@/features/partners/lib/get-partner-summary", () => ({ getPartnerSummary: getSummaryMock }));
vi.mock("@/features/roi/lib/get-baseline-inputs", () => ({ getBaselineInputs: getBaselineMock }));
vi.mock("@/features/roi/components/baseline-inputs-form", () => ({
  BaselineInputsForm: ({ defaultValues }: { defaultValues?: unknown }) => `FORM:${defaultValues ? "saved" : "empty"}`,
}));

import PartnerBaselineInputsPage from "@/app/(partner)/partner/roi/baseline/page";

const USER = { id: "user-1", role: "partner_user" as const, partner_id: "partner-a" };

const render = async () => renderToStaticMarkup((await PartnerBaselineInputsPage()) as never);

describe("PartnerBaselineInputsPage (VI-F05-S05, AC02)", () => {
  beforeEach(() => {
    requirePartnerScopeMock.mockReset();
    requirePartnerScopeMock.mockResolvedValue(USER);
    getSummaryMock.mockReset();
    getSummaryMock.mockResolvedValue({ name: "Emirates Rent A Car", code: "EMR" });
    getBaselineMock.mockReset();
    getBaselineMock.mockResolvedValue(null);
  });

  it("should guard the page with bookings:manage_own_partner", async () => {
    await render();

    expect(requirePartnerScopeMock).toHaveBeenCalledWith("bookings:manage_own_partner");
  });

  it("should refuse a user without the permission, and read nothing (Permission Denied)", async () => {
    requirePartnerScopeMock.mockRejectedValue(new Error("FORBIDDEN"));

    await expect(render()).rejects.toThrow("FORBIDDEN");
    expect(getSummaryMock).not.toHaveBeenCalled();
    expect(getBaselineMock).not.toHaveBeenCalled();
  });

  it("should read the partner and the baseline of the signed-in user, never ones taken from the request", async () => {
    await render();

    expect(getSummaryMock).toHaveBeenCalledWith("partner-a");
    expect(getBaselineMock).toHaveBeenCalledWith("partner-a");
  });

  it("should draw the title and the line with the partner name of the design", async () => {
    const html = await render();

    expect(html).toContain("Baseline inputs");
    expect(html).toContain("Emirates Rent A Car · Assumptions for estimated business value only");
  });

  it("should give an empty form when no baseline is saved yet (Empty)", async () => {
    expect(await render()).toContain("FORM:empty");
  });

  it("should fill the form with the saved baseline (Success)", async () => {
    getBaselineMock.mockResolvedValue({ monthly_staff_cost: 2400 });

    expect(await render()).toContain("FORM:saved");
  });

  it("should say the partner could not be found, and draw no form, when it cannot be read", async () => {
    getSummaryMock.mockResolvedValue(null);

    const html = await render();

    expect(html).toContain("Your partner could not be found");
    expect(html).not.toContain("FORM:");
  });

  it("should throw a failed read to the error boundary, never show it as an empty screen (Error)", async () => {
    getBaselineMock.mockRejectedValue(new Error("Could not read the baseline inputs"));

    await expect(render()).rejects.toThrow("Could not read the baseline inputs");
  });
});
