import { describe, expect, it, vi } from "vitest";

import { createClient } from "@/lib/supabase/server";
import {
  STATEMENT_BATCH,
  getInvoiceStatementHead,
  monthWindow,
  statementBookingBatches,
} from "@/features/invoices/lib/get-invoice-statement";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const ID = "d9100000-0000-0000-0000-000000000001";
const HEAD = { invoice_number: "INV-1", partner_id: "p-a", period_start: "2026-09-01" };

/** A query that records its calls and answers each awaited request with the next answer. */
function fakeClient(answers: Array<{ data: unknown; error: { code?: string } | null }>) {
  const calls: unknown[][] = [];
  const query: Record<string, unknown> = {};

  for (const method of ["select", "eq", "in", "not", "or", "order", "limit", "gt"]) {
    query[method] = vi.fn((...args: unknown[]) => {
      calls.push([method, ...args]);
      return query;
    });
  }
  query.maybeSingle = vi.fn(() => Promise.resolve(answers[0]));
  query.then = (resolve: (value: unknown) => void) => resolve(answers.shift());
  vi.mocked(createClient).mockResolvedValue({ from: vi.fn(() => query) } as never);

  return calls;
}

const rows = (count: number, from = 0) =>
  Array.from({ length: count }, (_, index) => ({ booking_number: `BK-${String(from + index).padStart(6, "0")}` }));

const collect = async (generator: AsyncGenerator<unknown[]>) => {
  const batches: unknown[][] = [];

  for await (const batch of generator) {
    batches.push(batch);
  }

  return batches;
};

describe("getInvoiceStatementHead (VI-F09-S05)", () => {
  it("should not ask the database about an id that is not a uuid", async () => {
    vi.mocked(createClient).mockClear();

    await expect(getInvoiceStatementHead("1; drop table invoices", false)).resolves.toBeNull();
    expect(createClient).not.toHaveBeenCalled();
  });

  it("should ask a partner user only for the statuses it may see, and answer null for a hidden invoice", async () => {
    const calls = fakeClient([{ data: null, error: null }]);

    await expect(getInvoiceStatementHead(ID, true)).resolves.toBeNull();
    expect(calls).toContainEqual(["in", "status", ["issued", "paid", "overdue"]]);
  });

  it("should flatten the month of the settlement, and throw a failed read", async () => {
    fakeClient([{ data: { invoice_number: "INV-1", partner_id: "p-a", settlement: { period_start: "2026-09-01" } }, error: null }]);
    await expect(getInvoiceStatementHead(ID, false)).resolves.toEqual(HEAD);

    fakeClient([{ data: null, error: { code: "XX000" } }]);
    await expect(getInvoiceStatementHead(ID, false)).rejects.toEqual({ code: "XX000" });
  });
});

describe("statementBookingBatches (VI-F09-S05, AC02)", () => {
  it("should read the month in UTC, from the first day to the first day of the next month", () => {
    expect(monthWindow("2026-12-01")).toEqual({ from: "2026-12-01T00:00:00.000Z", to: "2027-01-01T00:00:00.000Z" });
  });

  it("should read nothing for an invoice with no settlement", async () => {
    vi.mocked(createClient).mockClear();

    await expect(collect(statementBookingBatches({ ...HEAD, period_start: null }))).resolves.toEqual([]);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("should ask only for the completed rentals with revenue of the partner in the month", async () => {
    const calls = fakeClient([{ data: rows(2), error: null }]);

    await collect(statementBookingBatches(HEAD));

    expect(calls).toContainEqual(["eq", "partner_id", "p-a"]);
    expect(calls).toContainEqual(["eq", "status", "completed"]);
    expect(calls).toContainEqual(["in", "revenue_case", ["standard", "early_return"]]);
    expect(calls).toContainEqual(["not", "gross_revenue", "is", null]);
    expect(calls).toContainEqual([
      "or",
      "and(actual_return_at.gte.2026-09-01T00:00:00.000Z,actual_return_at.lt.2026-10-01T00:00:00.000Z),and(actual_return_at.is.null,return_at.gte.2026-09-01T00:00:00.000Z,return_at.lt.2026-10-01T00:00:00.000Z)",
    ]);
  });

  it("should read a statement of many bookings in batches after the last number, and lose none", async () => {
    const calls = fakeClient([
      { data: rows(STATEMENT_BATCH), error: null },
      { data: rows(STATEMENT_BATCH, STATEMENT_BATCH), error: null },
      { data: rows(5, 2 * STATEMENT_BATCH), error: null },
    ]);

    const batches = await collect(statementBookingBatches(HEAD));

    expect(batches.map((batch) => batch.length)).toEqual([STATEMENT_BATCH, STATEMENT_BATCH, 5]);
    expect(calls.filter(([method]) => method === "gt")).toEqual([
      ["gt", "booking_number", `BK-${String(STATEMENT_BATCH - 1).padStart(6, "0")}`],
      ["gt", "booking_number", `BK-${String(2 * STATEMENT_BATCH - 1).padStart(6, "0")}`],
    ]);
  });

  it("should ask once more when a batch is exactly full, and stop on an empty one", async () => {
    fakeClient([
      { data: rows(STATEMENT_BATCH), error: null },
      { data: [], error: null },
    ]);

    await expect(collect(statementBookingBatches(HEAD))).resolves.toHaveLength(1);
  });

  it("should throw a failed read, not end the statement as if it were complete", async () => {
    fakeClient([{ data: null, error: { code: "XX000" } }]);

    await expect(collect(statementBookingBatches(HEAD))).rejects.toEqual({ code: "XX000" });
  });
});
