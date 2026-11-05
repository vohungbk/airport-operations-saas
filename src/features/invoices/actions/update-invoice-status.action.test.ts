import { beforeEach, describe, expect, it, vi } from "vitest";

const requireRoleMock = vi.hoisted(() => vi.fn());
const rpcMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());
/** What Next throws for `forbidden()`: an error whose digest starts with `NEXT_`. */
const forbiddenMock = vi.hoisted(() =>
  vi.fn(() => {
    throw Object.assign(new Error("NEXT_HTTP_ERROR_FALLBACK;403"), { digest: "NEXT_HTTP_ERROR_FALLBACK;403" });
  }),
);

vi.mock("@/lib/auth/current-user", () => ({ requireRole: requireRoleMock }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc: rpcMock }) }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("next/navigation", () => ({ forbidden: forbiddenMock }));

import { updateInvoiceStatusAction } from "@/features/invoices/actions/update-invoice-status.action";

const ID = "d9100000-0000-0000-0000-000000000001";
const PAID = { id: ID, invoice_number: "INV-2026-000044", status: "paid" };

describe("updateInvoiceStatusAction (VI-F09-S08)", () => {
  beforeEach(() => {
    requireRoleMock.mockReset();
    requireRoleMock.mockResolvedValue({ id: "u-1", role: "admin" });
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({ data: PAID, error: null });
    revalidatePathMock.mockClear();
    forbiddenMock.mockClear();
  });

  it("should save the status through the database function and give the new status (AC03)", async () => {
    const result = await updateInvoiceStatusAction({ invoice_id: ID, status: "paid" });

    expect(rpcMock).toHaveBeenCalledWith("update_invoice_status", { p_invoice_id: ID, p_to: "paid" });
    expect(result).toEqual({ success: true, invoice: { id: ID, invoice_number: "INV-2026-000044", status: "paid" } });
    expect(revalidatePathMock).toHaveBeenCalledWith("/invoices");
    expect(revalidatePathMock).toHaveBeenCalledWith(`/invoices/${ID}`);
  });

  it("should send the reason of a void (AC05)", async () => {
    rpcMock.mockResolvedValue({ data: { ...PAID, status: "void" }, error: null });

    await updateInvoiceStatusAction({ invoice_id: ID, status: "void", reason: "  Wrong partner  " });

    expect(rpcMock).toHaveBeenCalledWith("update_invoice_status", { p_invoice_id: ID, p_to: "void", p_reason: "Wrong partner" });
  });

  it("should check the role before anything else, and allow admin only", async () => {
    requireRoleMock.mockRejectedValue(new Error("FORBIDDEN"));

    await expect(updateInvoiceStatusAction({ invoice_id: ID, status: "paid" })).rejects.toThrow("FORBIDDEN");
    expect(requireRoleMock).toHaveBeenCalledWith(["admin"]);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it.each([
    ["a missing id", { status: "paid" }],
    ["a status outside the list", { invoice_id: ID, status: "refunded" }],
    ["a void with no reason", { invoice_id: ID, status: "void" }],
  ])("should refuse %s and not call the database (AC04)", async (_name, input) => {
    const result = await updateInvoiceStatusAction(input);

    expect(result).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("should name the reason as the field of a void with no reason", async () => {
    await expect(updateInvoiceStatusAction({ invoice_id: ID, status: "void" })).resolves.toMatchObject({
      error: { field: "reason", message: "Enter a reason for voiding the invoice." },
    });
  });

  it.each([
    ["IV004", "CONFLICT"],
    ["IV005", "VALIDATION_ERROR"],
    ["P0002", "NOT_FOUND"],
    ["22023", "VALIDATION_ERROR"],
    ["XX000", "INTERNAL_ERROR"],
  ])("should answer %s with the stable code %s, never with the raw error", async (code, expected) => {
    rpcMock.mockResolvedValue({ data: null, error: { code, message: "connection to db.internal refused" } });

    const result = await updateInvoiceStatusAction({ invoice_id: ID, status: "paid" });

    expect(result).toMatchObject({ success: false, error: { code: expected } });
    expect(JSON.stringify(result)).not.toContain("db.internal");
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("should reject a change that is not allowed with a clear message (AC04)", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: "IV004" } });

    await expect(updateInvoiceStatusAction({ invoice_id: ID, status: "issued" })).resolves.toMatchObject({
      success: false,
      error: { message: "This status change is not allowed for the invoice as it is now. Reload the page to see it." },
    });
  });

  it("should send the user to the forbidden state, not a message in the form, when the database says the role is gone (E9)", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: "42501", message: "connection to db.internal refused" } });

    const error = await updateInvoiceStatusAction({ invoice_id: ID, status: "paid" }).catch((caught: unknown) => caught);

    expect(forbiddenMock).toHaveBeenCalledTimes(1);
    expect(error).toMatchObject({ digest: "NEXT_HTTP_ERROR_FALLBACK;403" });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("should not call forbidden for an error that is not a refusal of the role", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: "XX000" } });

    await updateInvoiceStatusAction({ invoice_id: ID, status: "paid" });

    expect(forbiddenMock).not.toHaveBeenCalled();
  });
});
