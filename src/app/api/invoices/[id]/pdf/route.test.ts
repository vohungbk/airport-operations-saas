import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserMock = vi.hoisted(() => vi.fn());
const getInvoiceMock = vi.hoisted(() => vi.fn());
const buildPdfMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({ getCurrentUser: getCurrentUserMock }));
vi.mock("@/features/invoices/lib/get-invoice", () => ({ getInvoice: getInvoiceMock }));
vi.mock("@/features/invoices/lib/invoice-pdf", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/features/invoices/lib/invoice-pdf")>();
  buildPdfMock.mockImplementation(original.buildInvoicePdf);

  return { ...original, buildInvoicePdf: buildPdfMock };
});

import { GET } from "@/app/api/invoices/[id]/pdf/route";

const ID = "d9100000-0000-0000-0000-000000000001";

const call = (id = ID) => GET(new Request(`http://localhost/api/invoices/${id}/pdf`) as never, { params: Promise.resolve({ id }) });

const asUser = (role: string, extra: Record<string, unknown> = {}) =>
  getCurrentUserMock.mockResolvedValue({
    id: "u-1",
    role,
    partner_id: role === "partner_user" ? "p-a" : null,
    partner_status: role === "partner_user" ? "active" : null,
    ...extra,
  });

const INVOICE = {
  id: ID,
  invoice_number: "INV-2026-000045",
  issue_date: "2026-10-01",
  due_date: "2026-10-31",
  subtotal: 5050,
  vat: 252.5,
  total: 5302.5,
  status: "issued",
  partner: { name: "Emirates Rent A Car", code: "EMR" },
  period_start: "2026-09-01",
  lines: [{ position: 1, description: "Platform share", amount: 5050, counts_toward_subtotal: true }],
};

describe("GET /api/invoices/[id]/pdf (VI-F09-S04)", () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset();
    getInvoiceMock.mockReset();
    getInvoiceMock.mockResolvedValue(INVOICE);
    asUser("partner_user");
  });

  it("should give the invoice as a PDF download to a partner user (AC01)", async () => {
    const response = await call();
    const bytes = new Uint8Array(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="INV-2026-000045.pdf"');
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-length")).toBe(String(bytes.byteLength));
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
  });

  it("should read the invoice with the scope of the role: a partner user as a partner, an admin as an operations user", async () => {
    await call();
    asUser("admin");
    await call();

    expect(getInvoiceMock.mock.calls.map((callArgs) => callArgs[1])).toEqual([true, false]);
  });

  it("should answer 401 when nobody is signed in, and read nothing", async () => {
    getCurrentUserMock.mockResolvedValue(null);

    const response = await call();

    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("UNAUTHORIZED");
    expect(getInvoiceMock).not.toHaveBeenCalled();
  });

  it("should answer 403 to a technician, and read nothing", async () => {
    asUser("technician");

    const response = await call();

    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("FORBIDDEN");
    expect(getInvoiceMock).not.toHaveBeenCalled();
  });

  it.each([
    ["no partner", { partner_id: null, partner_status: null }],
    ["an inactive partner", { partner_status: "inactive" }],
  ])("should answer 403 to a partner user with %s", async (_name, extra) => {
    asUser("partner_user", extra);

    expect((await call()).status).toBe(403);
    expect(getInvoiceMock).not.toHaveBeenCalled();
  });

  it("should answer 404, the same for an unknown, malformed or hidden invoice, and build nothing", async () => {
    getInvoiceMock.mockResolvedValue(null);
    buildPdfMock.mockClear();

    const response = await call("another-partners-invoice");

    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("NOT_FOUND");
    expect(buildPdfMock).not.toHaveBeenCalled();
  });

  it("should answer 500 in the standard shape, never with the raw error, when the PDF cannot be built (AC04)", async () => {
    buildPdfMock.mockRejectedValueOnce(new Error("connection to db.internal:5432 refused"));

    const response = await call();
    const text = await response.text();

    expect(response.status).toBe(500);
    expect(JSON.parse(text).error.code).toBe("INTERNAL_ERROR");
    expect(text).not.toContain("db.internal");
  });

  it("should answer 500 when the invoice cannot be read, and let a second try give the file (AC04, retry)", async () => {
    getInvoiceMock.mockRejectedValueOnce(new Error("db down"));

    expect((await call()).status).toBe(500);
    expect((await call()).status).toBe(200);
  });

  it("should make a number that is not safe in a file name safe in the header", async () => {
    getInvoiceMock.mockResolvedValue({ ...INVOICE, invoice_number: 'INV"\r\nX' });

    const header = (await call()).headers.get("content-disposition") ?? "";

    expect(header).toBe('attachment; filename="INV___X.pdf"');
  });
});
