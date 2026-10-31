import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserMock = vi.hoisted(() => vi.fn());
const headMock = vi.hoisted(() => vi.fn());
const batchesMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({ getCurrentUser: getCurrentUserMock }));
vi.mock("@/features/invoices/lib/get-invoice-statement", () => ({
  getInvoiceStatementHead: headMock,
  statementBookingBatches: batchesMock,
}));

import { GET } from "@/app/api/invoices/[id]/statement/route";

const ID = "d9100000-0000-0000-0000-000000000001";
const HEAD = { invoice_number: "INV-2026-000045", partner_id: "p-a", period_start: "2026-09-01" };

const call = (id = ID) =>
  GET(new Request(`http://localhost/api/invoices/${id}/statement`) as never, { params: Promise.resolve({ id }) });

const asUser = (role: string, extra: Record<string, unknown> = {}) =>
  getCurrentUserMock.mockResolvedValue({
    id: "u-1",
    role,
    partner_id: role === "partner_user" ? "p-a" : null,
    partner_status: role === "partner_user" ? "active" : null,
    ...extra,
  });

const booking = (number: string) => ({
  booking_number: number,
  revenue_case: "standard",
  paid_days: 2,
  gross_revenue: 60,
  partner_share: 42,
  platform_share: 18,
  launch_credit: 0,
  adjustments_total: 0,
  return_at: "2026-09-12T10:00:00+00:00",
  actual_return_at: null,
});

const batchesOf = (...batches: unknown[][]) =>
  (async function* () {
    yield* batches;
  })();

describe("GET /api/invoices/[id]/statement (VI-F09-S05)", () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset();
    headMock.mockReset();
    batchesMock.mockReset();
    headMock.mockResolvedValue(HEAD);
    batchesMock.mockImplementation(() => batchesOf([booking("BK-1")]));
    asUser("partner_user");
  });

  it("should give the booking statement as a CSV download to a partner user (AC01)", async () => {
    const response = await call();
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="INV-2026-000045-statement.csv"');
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(text.split("\r\n")).toEqual([
      expect.stringContaining("Booking number,Returned,Case"),
      "BK-1,2026-09-12,Standard,2,60.00,42.00,18.00,0.00,0.00",
      "",
    ]);
  });

  it("should stream every batch of a long statement, in order (AC02)", async () => {
    batchesMock.mockImplementation(() => batchesOf([booking("BK-1"), booking("BK-2")], [booking("BK-3")], [booking("BK-4")]));

    const lines = (await (await call()).text()).split("\r\n").slice(1, -1);

    expect(lines.map((line) => line.split(",")[0])).toEqual(["BK-1", "BK-2", "BK-3", "BK-4"]);
  });

  it("should give the header alone when the invoice has no booking, so the download still works", async () => {
    batchesMock.mockImplementation(() => batchesOf());

    const response = await call();

    expect(response.status).toBe(200);
    expect((await response.text()).split("\r\n")).toEqual([expect.stringContaining("Booking number"), ""]);
  });

  it("should read the invoice with the scope of the role: a partner user as a partner, an admin as an operations user", async () => {
    await call();
    asUser("admin");
    await call();

    expect(headMock.mock.calls.map((args) => args[1])).toEqual([true, false]);
  });

  it("should answer 401 when nobody is signed in, and read nothing", async () => {
    getCurrentUserMock.mockResolvedValue(null);

    const response = await call();

    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("UNAUTHORIZED");
    expect(headMock).not.toHaveBeenCalled();
  });

  it.each([
    ["a technician", "technician", {}],
    ["a partner user with no partner", "partner_user", { partner_id: null, partner_status: null }],
    ["a partner user of an inactive partner", "partner_user", { partner_status: "inactive" }],
  ])("should answer 403 to %s, and read nothing", async (_name, role, extra) => {
    asUser(role, extra);

    const response = await call();

    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("FORBIDDEN");
    expect(headMock).not.toHaveBeenCalled();
  });

  it("should answer 404, the same for an unknown, malformed or hidden invoice, and read no booking", async () => {
    headMock.mockResolvedValue(null);

    const response = await call("another-partners-invoice");

    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("NOT_FOUND");
    expect(batchesMock).not.toHaveBeenCalled();
  });

  it("should answer 500 in the standard shape, never with the raw error, when the first bookings cannot be read", async () => {
    batchesMock.mockImplementation(() => ({
      next: () => Promise.reject(new Error("connection to db.internal:5432 refused")),
      return: () => Promise.resolve({ done: true, value: undefined }),
    }));

    const response = await call();
    const text = await response.text();

    expect(response.status).toBe(500);
    expect(JSON.parse(text).error.code).toBe("INTERNAL_ERROR");
    expect(text).not.toContain("db.internal");
  });

  it("should end the download with an error, not a file that looks complete, when a later batch fails", async () => {
    batchesMock.mockImplementation(() =>
      (async function* () {
        yield [booking("BK-1")];
        throw new Error("db down");
      })(),
    );

    const response = await call();

    expect(response.status).toBe(200);
    await expect(response.text()).rejects.toThrow("db down");
  });

  it("should make a number that is not safe in a file name safe in the header", async () => {
    headMock.mockResolvedValue({ ...HEAD, invoice_number: 'INV"\r\nX' });

    expect((await call()).headers.get("content-disposition")).toBe('attachment; filename="INV___X-statement.csv"');
  });
});
