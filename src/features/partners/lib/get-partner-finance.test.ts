import { describe, expect, it, vi } from "vitest";

import { createClient } from "@/lib/supabase/server";
import {
  FINANCE_INVOICE_SELECT,
  getPartnerFinance,
} from "@/features/partners/lib/get-partner-finance";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

type Answer = { data: unknown; error: { code?: string } | null };

/** A client whose request for each table resolves to what `answers` gives for it. */
function fakeClient(answers: Record<string, Answer>) {
  const calls: unknown[][] = [];
  const from = vi.fn((table: string) => {
    calls.push(["from", table]);
    const query: Record<string, unknown> = {};
    for (const method of ["select", "in", "lte", "order", "limit"]) {
      query[method] = vi.fn((...args: unknown[]) => {
        calls.push([method, table, ...args]);
        return query;
      });
    }
    query.maybeSingle = vi.fn(() => Promise.resolve(answers[table]));
    query.then = (resolve: (value: Answer) => unknown) => resolve(answers[table]);
    return query;
  });
  vi.mocked(createClient).mockResolvedValue({ from } as never);

  return calls;
}

const OK = (data: unknown): Answer => ({ data, error: null });

describe("getPartnerFinance (VI-F04-S14)", () => {
  it("should read only what a partner may see, and send no partner id (RLS is the scope)", async () => {
    const calls = fakeClient({
      settlements: OK(null),
      invoices: OK([]),
      partner_commercial_terms: OK(null),
    });

    await getPartnerFinance();

    expect(calls).toContainEqual(["in", "settlements", "status", ["approved", "paid"]]);
    expect(calls).toContainEqual(["in", "invoices", "status", ["issued", "paid", "overdue"]]);
    expect(calls).toContainEqual(["select", "invoices", FINANCE_INVOICE_SELECT]);
    expect(calls.some((call) => call[0] === "eq")).toBe(false);
  });

  it("should read the terms in force today, not a version that starts later", async () => {
    const calls = fakeClient({
      settlements: OK(null),
      invoices: OK([]),
      partner_commercial_terms: OK(null),
    });

    await getPartnerFinance();

    expect(calls).toContainEqual([
      "lte",
      "partner_commercial_terms",
      "effective_from",
      new Date().toISOString().slice(0, 10),
    ]);
  });

  it("should flatten the period of the settlement into each invoice", async () => {
    fakeClient({
      settlements: OK({ period_start: "2026-10-01", gross_revenue: 1, partner_share: 1, final_amount: 1 }),
      invoices: OK([
        { id: "i-1", invoice_number: "INV-1", issue_date: "2026-10-31", total: 10, status: "issued", settlement: { period_start: "2026-10-01" } },
        { id: "i-2", invoice_number: "INV-2", issue_date: "2026-10-31", total: 10, status: "paid", settlement: null },
      ]),
      partner_commercial_terms: OK(null),
    });

    const { invoices } = await getPartnerFinance();

    expect(invoices.map((invoice) => invoice.period_start)).toEqual(["2026-10-01", null]);
    expect(invoices[0]).not.toHaveProperty("settlement");
  });

  it("should throw, not return an empty screen, when a read fails", async () => {
    fakeClient({
      settlements: OK(null),
      invoices: { data: null, error: { code: "42501" } },
      partner_commercial_terms: OK(null),
    });

    await expect(getPartnerFinance()).rejects.toThrow("Could not read the finance of the partner");
  });
});
