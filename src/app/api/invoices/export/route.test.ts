import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserMock = vi.hoisted(() => vi.fn());
const getInvoicesForExportMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({ getCurrentUser: getCurrentUserMock }));
vi.mock("@/features/invoices/lib/get-invoices", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/invoices/lib/get-invoices")>()),
  getInvoicesForExport: getInvoicesForExportMock,
}));

import { GET } from "@/app/api/invoices/export/route";
import { InvoiceExportTooLargeError } from "@/features/invoices/lib/get-invoices";

const call = (search = "") => GET(new Request(`http://localhost/api/invoices/export${search}`) as never);

const asUser = (role: string, extra: Record<string, unknown> = {}) =>
  getCurrentUserMock.mockResolvedValue({
    id: "u-1",
    role,
    partner_id: role === "partner_user" ? "p-a" : null,
    partner_status: role === "partner_user" ? "active" : null,
    ...extra,
  });

const INVOICE = {
  id: "i-1",
  invoice_number: "INV-2026-000045",
  partner: { name: "Emirates Rent A Car", code: "EMR" },
  period_start: "2026-09-01",
  issue_date: "2026-09-30",
  due_date: "2026-11-15",
  total: 2400,
  status: "issued",
};

describe("GET /api/invoices/export (VI-F09-S02)", () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset();
    getInvoicesForExportMock.mockReset();
    getInvoicesForExportMock.mockResolvedValue([INVOICE]);
    asUser("operations_manager");
  });

  it("should give the invoices as a CSV download", async () => {
    const response = await call();
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("content-disposition")).toMatch(/^attachment; filename="invoices-\d{4}-\d{2}-\d{2}\.csv"$/);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(body).toContain("INV-2026-000045,Emirates Rent A Car,2026-09,2400.00,2026-11-15,Issued");
  });

  it("should read the filters and the sort of the list from the address, and the page of it for nothing", async () => {
    await call("?q=INV&status=paid&from=2026-01&to=2026-06&sort=amount&order=asc&page=3&page_size=10");

    const query = getInvoicesForExportMock.mock.calls[0][0];
    expect(query).toMatchObject({ q: "INV", status: "paid", from: "2026-01", to: "2026-06", sort: "amount", order: "asc" });
    expect(getInvoicesForExportMock.mock.calls[0][1]).toBe(false);
  });

  it("should give an admin the Partner column, and a partner user the file without it", async () => {
    asUser("admin");
    expect(await (await call()).text()).toContain("Invoice number,Partner,");

    asUser("partner_user");
    const partner = await (await call()).text();

    expect(partner).toContain("Invoice number,Period,");
    expect(partner).not.toContain("Partner,");
    expect(getInvoicesForExportMock.mock.calls[1][1]).toBe(true);
  });

  it("should drop the partner a partner user names in the address, and keep it for an operations user", async () => {
    const other = "b0000000-0000-0000-0000-000000000002";

    asUser("partner_user");
    await call(`?partner_id=${other}`);
    asUser("admin");
    await call(`?partner_id=${other}`);

    expect(getInvoicesForExportMock.mock.calls[0][0]).not.toHaveProperty("partner_id");
    expect(getInvoicesForExportMock.mock.calls[1][0].partner_id).toBe(other);
  });

  it("should give the header line alone when nothing matches", async () => {
    getInvoicesForExportMock.mockResolvedValue([]);

    const body = await (await call("?status=void")).text();

    expect(body.replace("﻿", "").trim()).toBe("Invoice number,Partner,Period,Amount (USD),Due date,Payment status");
  });

  it("should answer 401 when nobody is signed in, and read nothing", async () => {
    getCurrentUserMock.mockResolvedValue(null);

    const response = await call();

    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("UNAUTHORIZED");
    expect(getInvoicesForExportMock).not.toHaveBeenCalled();
  });

  it("should answer 403 to a technician, and read nothing", async () => {
    asUser("technician");

    const response = await call();

    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("FORBIDDEN");
    expect(getInvoicesForExportMock).not.toHaveBeenCalled();
  });

  it.each([
    ["no partner", { partner_id: null, partner_status: null }],
    ["an inactive partner", { partner_status: "inactive" }],
  ])("should answer 403 to a partner user with %s", async (_name, extra) => {
    asUser("partner_user", extra);

    expect((await call()).status).toBe(403);
    expect(getInvoicesForExportMock).not.toHaveBeenCalled();
  });

  it("should ask to narrow the filters, and send no file, when too many invoices match", async () => {
    getInvoicesForExportMock.mockRejectedValue(new InvoiceExportTooLargeError(12_000));

    const response = await call();
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toContain("Narrow the filters");
  });

  it("should answer 500 in the standard shape, never with the raw error, when the read fails", async () => {
    getInvoicesForExportMock.mockRejectedValue(new Error("connection to db.internal:5432 refused"));

    const response = await call();
    const text = await response.text();

    expect(response.status).toBe(500);
    expect(JSON.parse(text).error.code).toBe("INTERNAL_ERROR");
    expect(text).not.toContain("db.internal");
  });

  it("should fall back to the defaults for a value that makes no sense", async () => {
    await call("?sort=id%3Bdrop&order=sideways&status=refunded&from=2026-13");

    expect(getInvoicesForExportMock.mock.calls[0][0]).toMatchObject({ sort: "due_date", order: "desc" });
    expect(getInvoicesForExportMock.mock.calls[0][0].status).toBeUndefined();
    expect(getInvoicesForExportMock.mock.calls[0][0].from).toBeUndefined();
  });
});
