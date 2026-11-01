import { beforeEach, describe, expect, it, vi } from "vitest";

const requireRoleMock = vi.hoisted(() => vi.fn());
const rpcMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({ requireRole: requireRoleMock }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc: rpcMock }) }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

import { issueInvoiceAction } from "@/features/invoices/actions/issue-invoice.action";

const ID = "d9100000-0000-0000-0000-000000000001";
const ISSUED = { id: ID, invoice_number: "INV-2026-000044", issue_date: "2026-10-01", due_date: "2026-10-15", status: "issued" };

describe("issueInvoiceAction (VI-F09-S07)", () => {
  beforeEach(() => {
    requireRoleMock.mockReset();
    requireRoleMock.mockResolvedValue({ id: "u-1", role: "admin" });
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({ data: ISSUED, error: null });
    revalidatePathMock.mockClear();
  });

  it("should issue through the database function and give the dates (AC01)", async () => {
    const result = await issueInvoiceAction({ invoice_id: ID });

    expect(rpcMock).toHaveBeenCalledWith("issue_invoice", { p_invoice_id: ID });
    expect(result).toEqual({
      success: true,
      invoice: { id: ID, invoice_number: "INV-2026-000044", issue_date: "2026-10-01", due_date: "2026-10-15" },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/invoices");
    expect(revalidatePathMock).toHaveBeenCalledWith(`/invoices/${ID}`);
  });

  it("should check the role before anything else, and allow admin only", async () => {
    requireRoleMock.mockRejectedValue(new Error("FORBIDDEN"));

    await expect(issueInvoiceAction({ invoice_id: ID })).rejects.toThrow("FORBIDDEN");
    expect(requireRoleMock).toHaveBeenCalledWith(["admin"]);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it.each([
    ["a missing id", {}],
    ["an id that is not an id", { invoice_id: "abc" }],
  ])("should refuse %s and not call the database", async (_name, input) => {
    const result = await issueInvoiceAction(input);

    expect(result).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it.each([
    ["IV002", "CONFLICT"],
    ["P0002", "NOT_FOUND"],
    ["42501", "FORBIDDEN"],
    ["22023", "VALIDATION_ERROR"],
    ["XX000", "INTERNAL_ERROR"],
  ])("should answer %s with the stable code %s, never with the raw error", async (code, expected) => {
    rpcMock.mockResolvedValue({ data: null, error: { code, message: "connection to db.internal refused" } });

    const result = await issueInvoiceAction({ invoice_id: ID });

    expect(result).toMatchObject({ success: false, error: { code: expected } });
    expect(JSON.stringify(result)).not.toContain("db.internal");
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("should say the invoice is no longer a draft when it was issued by someone else (AC01)", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: "IV002" } });

    await expect(issueInvoiceAction({ invoice_id: ID })).resolves.toMatchObject({
      success: false,
      error: { message: "This invoice is no longer a draft. Reload the page to see it." },
    });
  });
});
