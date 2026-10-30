import { describe, expect, it, vi } from "vitest";

import {
  INVOICE_EXPORT_BATCH,
  INVOICE_EXPORT_LIMIT,
  INVOICE_LIST_SELECT,
  INVOICE_LIST_SELECT_BY_PERIOD,
  InvoiceExportTooLargeError,
  getInvoices,
  getInvoicesForExport,
} from "@/features/invoices/lib/get-invoices";
import { invoicesQuerySchema, resolveInvoicesQuery } from "@/features/invoices/schemas/invoices-query.schema";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

type Answer = { data: unknown; count: number | null; error: { code?: string } | null };

/** A client whose requests resolve, one after the other, to the given answers; every call is recorded. */
function fakeClient(...answers: Answer[]) {
  const calls: unknown[][] = [];
  let next = 0;
  const query: Record<string, unknown> = {};

  for (const method of ["select", "in", "ilike", "eq", "gte", "lte", "order", "range"]) {
    query[method] = vi.fn((...args: unknown[]) => {
      calls.push([method, ...args]);
      return query;
    });
  }
  query.then = (resolve: (value: Answer) => unknown) => resolve(answers[Math.min(next++, answers.length - 1)]);

  return { client: { from: vi.fn(() => query) } as never, calls };
}

const OK = (data: unknown, count: number): Answer => ({ data, count, error: null });
const resolve = (raw: Record<string, string>, isPartner = false) => resolveInvoicesQuery(invoicesQuerySchema.parse(raw), isPartner);

const ROW = {
  id: "i-1",
  invoice_number: "INV-1",
  issue_date: "2026-09-30",
  due_date: "2026-10-18",
  total: 10,
  status: "issued",
  partner: { name: "P", code: "P" },
  settlement: { period_start: "2026-09-01" },
};

describe("getInvoices (VI-F09-S01)", () => {
  it("should ask a partner user only for the statuses it may see, and send no partner id for the scope", async () => {
    const { client, calls } = fakeClient(OK([], 0));

    await getInvoices(resolve({}, true), true, client);

    expect(calls).toContainEqual(["in", "status", ["issued", "paid", "overdue"]]);
    expect(calls.some((call) => call[0] === "eq" && call[1] === "partner_id")).toBe(false);
  });

  it("should show an operations user every status", async () => {
    const { client, calls } = fakeClient(OK([], 0));

    await getInvoices(resolve({}), false, client);

    expect(calls).toContainEqual(["in", "status", ["draft", "issued", "paid", "overdue", "void"]]);
  });

  it("should order by the column of the sort, then by id, and read only the rows of the page", async () => {
    const { client, calls } = fakeClient(OK([ROW], 40));

    await getInvoices(resolve({ sort: "amount", order: "asc", page: "2", page_size: "10" }), false, client);

    expect(calls).toContainEqual(["order", "total", { ascending: true }]);
    expect(calls).toContainEqual(["order", "id", { ascending: true }]);
    expect(calls).toContainEqual(["range", 10, 19]);
  });

  it("should take the characters of a search that mean something in a pattern literally", async () => {
    const { client, calls } = fakeClient(OK([], 0));

    await getInvoices(resolve({ q: "50%_off" }), false, client);

    expect(calls).toContainEqual(["ilike", "invoice_number", "%50\\%\\_off%"]);
  });

  it("should join the settlement only when the period filters, and filter on its month", async () => {
    const plain = fakeClient(OK([], 0));
    const filtered = fakeClient(OK([], 0));

    await getInvoices(resolve({}), false, plain.client);
    await getInvoices(resolve({ from: "2026-01", to: "2026-06" }), false, filtered.client);

    expect(plain.calls).toContainEqual(["select", INVOICE_LIST_SELECT, { count: "exact", head: false }]);
    expect(filtered.calls).toContainEqual(["select", INVOICE_LIST_SELECT_BY_PERIOD, { count: "exact", head: false }]);
    expect(filtered.calls).toContainEqual(["gte", "settlement.period_start", "2026-01-01"]);
    expect(filtered.calls).toContainEqual(["lte", "settlement.period_start", "2026-06-01"]);
  });

  it("should flatten the period of the settlement into each row", async () => {
    const { client } = fakeClient(OK([ROW, { ...ROW, id: "i-2", settlement: null }], 2));

    const { invoices, total } = await getInvoices(resolve({}), false, client);

    expect(total).toBe(2);
    expect(invoices.map((invoice) => invoice.period_start)).toEqual(["2026-09-01", null]);
    expect(invoices[0]).not.toHaveProperty("settlement");
  });

  it("should serve the last page when the page asked for is past the end", async () => {
    const { client } = fakeClient(
      { data: null, count: null, error: { code: "PGRST103" } },
      { data: null, count: 12, error: null },
      OK([ROW], 12),
    );

    const result = await getInvoices(resolve({ page: "9", page_size: "10" }), false, client);

    expect(result.page).toBe(2);
    expect(result.total).toBe(12);
  });

  it("should throw, not return an empty list, when the read fails", async () => {
    const { client } = fakeClient({ data: null, count: null, error: { code: "42501" } });

    await expect(getInvoices(resolve({}), false, client)).rejects.toMatchObject({ code: "42501" });
  });
});

describe("getInvoicesForExport (VI-F09-S02)", () => {
  const batch = (size: number) => Array.from({ length: size }, (_, index) => ({ ...ROW, id: `i-${index}` }));

  it("should read every invoice the filters match, in batches, in the order of the list", async () => {
    const { client, calls } = fakeClient(
      { data: null, count: 1500, error: null },
      OK(batch(INVOICE_EXPORT_BATCH), 1500),
      OK(batch(500), 1500),
    );

    const invoices = await getInvoicesForExport(resolve({ sort: "amount", order: "asc", page: "4", page_size: "10" }), false, client);

    expect(invoices).toHaveLength(1500);
    expect(calls).toContainEqual(["range", 0, INVOICE_EXPORT_BATCH - 1]);
    expect(calls).toContainEqual(["range", INVOICE_EXPORT_BATCH, 2 * INVOICE_EXPORT_BATCH - 1]);
    expect(calls).toContainEqual(["order", "total", { ascending: true }]);
    expect(calls).toContainEqual(["order", "id", { ascending: true }]);
  });

  it("should use the filters and the scope of the list: statuses of the role, search, period and partner", async () => {
    const { client, calls } = fakeClient({ data: null, count: 0, error: null });

    await getInvoicesForExport(
      resolve({ q: "50%", status: "paid", from: "2026-01", to: "2026-06", partner_id: "b0000000-0000-0000-0000-000000000001" }),
      false,
      client,
    );

    expect(calls).toContainEqual(["in", "status", ["draft", "issued", "paid", "overdue", "void"]]);
    expect(calls).toContainEqual(["ilike", "invoice_number", "%50\\%%"]);
    expect(calls).toContainEqual(["eq", "status", "paid"]);
    expect(calls).toContainEqual(["eq", "partner_id", "b0000000-0000-0000-0000-000000000001"]);
    expect(calls).toContainEqual(["gte", "settlement.period_start", "2026-01-01"]);
    expect(calls).toContainEqual(["lte", "settlement.period_start", "2026-06-01"]);
  });

  it("should ask a partner user only for the statuses it may see", async () => {
    const { client, calls } = fakeClient({ data: null, count: 0, error: null });

    await getInvoicesForExport(resolve({}, true), true, client);

    expect(calls).toContainEqual(["in", "status", ["issued", "paid", "overdue"]]);
  });

  it("should read nothing and give an empty list when nothing matches", async () => {
    const { client, calls } = fakeClient({ data: null, count: 0, error: null });

    await expect(getInvoicesForExport(resolve({}), false, client)).resolves.toEqual([]);
    expect(calls.some((call) => call[0] === "range")).toBe(false);
  });

  it("should refuse an export above the limit, with the number that matched, and read no row", async () => {
    const { client, calls } = fakeClient({ data: null, count: INVOICE_EXPORT_LIMIT + 1, error: null });

    await expect(getInvoicesForExport(resolve({}), false, client)).rejects.toMatchObject({
      total: INVOICE_EXPORT_LIMIT + 1,
    });
    await expect(getInvoicesForExport(resolve({}), false, client)).rejects.toBeInstanceOf(InvoiceExportTooLargeError);
    expect(calls.some((call) => call[0] === "range")).toBe(false);
  });

  it("should throw, not give a short file, when a batch fails", async () => {
    const { client } = fakeClient({ data: null, count: 5, error: null }, { data: null, count: null, error: { code: "42501" } });

    await expect(getInvoicesForExport(resolve({}), false, client)).rejects.toMatchObject({ code: "42501" });
  });
});
