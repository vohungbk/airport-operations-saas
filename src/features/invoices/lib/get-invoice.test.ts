import { describe, expect, it, vi } from "vitest";

import { createClient } from "@/lib/supabase/server";
import { INVOICE_DETAIL_SELECT, getInvoice } from "@/features/invoices/lib/get-invoice";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const ID = "d9100000-0000-0000-0000-000000000001";

function fakeClient(answer: { data: unknown; error: { code?: string } | null }) {
  const calls: unknown[][] = [];
  const query: Record<string, unknown> = {};

  for (const method of ["select", "eq", "in"]) {
    query[method] = vi.fn((...args: unknown[]) => {
      calls.push([method, ...args]);
      return query;
    });
  }
  query.maybeSingle = vi.fn(() => Promise.resolve(answer));
  vi.mocked(createClient).mockResolvedValue({ from: vi.fn(() => query) } as never);

  return calls;
}

describe("getInvoice (VI-F09-S01)", () => {
  it("should not ask the database about an id that is not a uuid", async () => {
    vi.mocked(createClient).mockClear();

    await expect(getInvoice("1; drop table invoices", false)).resolves.toBeNull();
    expect(createClient).not.toHaveBeenCalled();
  });

  it("should ask a partner user only for the statuses it may see", async () => {
    const calls = fakeClient({ data: null, error: null });

    await getInvoice(ID, true);

    expect(calls).toContainEqual(["select", INVOICE_DETAIL_SELECT]);
    expect(calls).toContainEqual(["eq", "id", ID]);
    expect(calls).toContainEqual(["in", "status", ["issued", "paid", "overdue"]]);
  });

  it("should answer null for an invoice that does not exist or that RLS hides, the same for both", async () => {
    fakeClient({ data: null, error: null });

    await expect(getInvoice(ID, true)).resolves.toBeNull();
  });

  it("should flatten the period of the settlement", async () => {
    fakeClient({
      data: { id: ID, invoice_number: "INV-1", total: 1, settlement: { period_start: "2026-10-01" } },
      error: null,
    });

    await expect(getInvoice(ID, false)).resolves.toMatchObject({ id: ID, period_start: "2026-10-01" });
  });

  it("should throw, not answer null, when the read fails", async () => {
    fakeClient({ data: null, error: { code: "42501" } });

    await expect(getInvoice(ID, false)).rejects.toMatchObject({ code: "42501" });
  });
});
