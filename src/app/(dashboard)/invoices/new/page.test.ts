import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireRoleMock = vi.hoisted(() => vi.fn());
const getPartnersMock = vi.hoisted(() => vi.fn());
const getPeriodsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({ requireRole: requireRoleMock }));
vi.mock("@/features/settlements/lib/get-settlement-partners", () => ({ getSettlementPartners: getPartnersMock }));
vi.mock("@/features/invoices/lib/get-invoiceable-periods", () => ({ getInvoiceablePeriods: getPeriodsMock }));
vi.mock("@/features/invoices/actions/generate-invoice.action", () => ({ generateInvoiceAction: vi.fn() }));

import GenerateInvoicePage from "@/app/(dashboard)/invoices/new/page";

describe("GenerateInvoicePage (VI-F09-S06, AC02, AC06)", () => {
  beforeEach(() => {
    requireRoleMock.mockReset();
    requireRoleMock.mockResolvedValue({ id: "u-1", role: "admin" });
    getPartnersMock.mockReset();
    getPartnersMock.mockResolvedValue([{ value: "p-1", label: "Emirates Rent A Car (EMR)" }]);
    getPeriodsMock.mockReset();
    getPeriodsMock.mockResolvedValue([]);
  });

  it("should check that the user is an admin before reading anything", async () => {
    await GenerateInvoicePage();

    expect(requireRoleMock).toHaveBeenCalledWith(["admin"]);
  });

  it("should propagate the refusal without reading a partner or a settlement (permission denied)", async () => {
    requireRoleMock.mockRejectedValue(new Error("FORBIDDEN"));

    await expect(GenerateInvoicePage()).rejects.toThrow("FORBIDDEN");
    expect(getPartnersMock).not.toHaveBeenCalled();
    expect(getPeriodsMock).not.toHaveBeenCalled();
  });

  it("should show the Generate invoice screen to an admin", async () => {
    const html = renderToStaticMarkup(await GenerateInvoicePage());

    expect(html).toContain("<h1");
    expect(html).toContain("Generate invoice");
    expect(html).toContain("Generate draft");
  });

  it("should let a failed read reach the error boundary, not show an empty form", async () => {
    getPeriodsMock.mockRejectedValue(new Error("db down"));

    await expect(GenerateInvoicePage()).rejects.toThrow("db down");
  });
});
