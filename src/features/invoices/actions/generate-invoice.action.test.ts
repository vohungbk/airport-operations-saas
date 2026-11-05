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

import { generateInvoiceAction } from "@/features/invoices/actions/generate-invoice.action";

const PARTNER = "b0000000-0000-0000-0000-000000000001";
const INVOICE = { id: "d9100000-0000-0000-0000-000000000001", invoice_number: "INV-2026-000044", total: 5302.5, vat: 252.5 };
const input = (change: Record<string, unknown> = {}) => ({ partner_id: PARTNER, month: "2026-09", ...change });

describe("generateInvoiceAction (VI-F09-S06)", () => {
  beforeEach(() => {
    requireRoleMock.mockReset();
    requireRoleMock.mockResolvedValue({ id: "u-1", role: "admin" });
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({ data: INVOICE, error: null });
    revalidatePathMock.mockClear();
    forbiddenMock.mockClear();
  });

  it("should generate through the database function and give the new invoice (AC04, AC07)", async () => {
    const result = await generateInvoiceAction(input());

    expect(rpcMock).toHaveBeenCalledWith("generate_invoice", { p_partner_id: PARTNER, p_month: "2026-09-01" });
    expect(result).toEqual({
      success: true,
      invoice: { id: INVOICE.id, invoice_number: "INV-2026-000044", total: 5302.5 },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/invoices");
  });

  it("should check the role before anything else, and allow admin only (AC02)", async () => {
    requireRoleMock.mockRejectedValue(new Error("FORBIDDEN"));

    await expect(generateInvoiceAction(input())).rejects.toThrow("FORBIDDEN");
    expect(requireRoleMock).toHaveBeenCalledWith(["admin"]);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it.each([
    ["a missing month", { month: undefined }, "month"],
    ["an empty month", { month: "" }, "month"],
    ["a month that is not a month", { month: "2026-13" }, "month"],
    ["a missing partner", { partner_id: undefined }, "partner_id"],
    ["a partner that is not an id", { partner_id: "abc" }, "partner_id"],
  ])("should refuse %s with a message on the field, and not call the database (AC03)", async (_name, change, field) => {
    const result = await generateInvoiceAction(input(change));

    expect(result).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR", field } });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it.each([
    ["IN002", "SETTLEMENT_NOT_APPROVED"],
    ["IN003", "CONFLICT"],
    ["P0002", "NOT_FOUND"],
    ["XX000", "INTERNAL_ERROR"],
  ])("should answer %s with the stable code %s, and not write anything else (AC09, AC10)", async (code, expected) => {
    rpcMock.mockResolvedValue({ data: null, error: { code, details: null, message: "connection to db.internal refused" } });

    const result = await generateInvoiceAction(input());

    expect(result).toMatchObject({ success: false, error: { code: expected } });
    expect(JSON.stringify(result)).not.toContain("db.internal");
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("should hand back the invoice that already exists when the database refuses a second one (AC10)", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: "IN003", details: INVOICE.id } });

    await expect(generateInvoiceAction(input())).resolves.toMatchObject({
      success: false,
      error: { code: "CONFLICT", existing_invoice_id: INVOICE.id },
    });
  });

  it("should send the user to the forbidden state, not a message in the form, when the database says the role is gone (E9)", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: "42501", message: "connection to db.internal refused" } });

    const error = await generateInvoiceAction(input()).catch((caught: unknown) => caught);

    expect(forbiddenMock).toHaveBeenCalledTimes(1);
    expect(error).toMatchObject({ digest: "NEXT_HTTP_ERROR_FALLBACK;403" });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("should not call forbidden for an error that is not a refusal of the role", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: "XX000" } });

    await generateInvoiceAction(input());

    expect(forbiddenMock).not.toHaveBeenCalled();
  });
});
