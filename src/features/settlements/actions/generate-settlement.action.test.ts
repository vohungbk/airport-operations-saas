import { beforeEach, describe, expect, it, vi } from "vitest";

const requireRoleMock = vi.hoisted(() => vi.fn());
const rpcMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() =>
  vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
);

vi.mock("@/lib/auth/current-user", () => ({ requireRole: requireRoleMock }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc: rpcMock }) }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

import { generateSettlementAction } from "@/features/settlements/actions/generate-settlement.action";

const PARTNER = "b0000000-0000-0000-0000-000000000001";
const input = (change: Record<string, unknown> = {}) => ({ partner_id: PARTNER, month: "2026-09", ...change });

describe("generateSettlementAction", () => {
  beforeEach(() => {
    requireRoleMock.mockReset();
    requireRoleMock.mockResolvedValue({ id: "u-1", role: "admin" });
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({ data: {}, error: null });
    revalidatePathMock.mockClear();
    redirectMock.mockClear();
  });

  it("should generate through the database function and go back to Settlements (AC05, AC06)", async () => {
    await expect(generateSettlementAction(input())).rejects.toThrow("REDIRECT:/settlements");

    expect(rpcMock).toHaveBeenCalledWith("generate_monthly_settlement", {
      p_partner_id: PARTNER,
      p_month: "2026-09-01",
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/settlements");
  });

  it("should check the role before anything else, and allow admin only (AC02)", async () => {
    requireRoleMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(generateSettlementAction(input())).rejects.toThrow("REDIRECT:/forbidden");
    expect(requireRoleMock).toHaveBeenCalledWith(["admin"]);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it.each([
    ["a missing month", { month: undefined }, "month"],
    ["an empty month", { month: "" }, "month"],
    ["a month in the future", { month: "2099-01" }, "month"],
    ["a month that is not a month", { month: "2026-13" }, "month"],
    ["a missing partner", { partner_id: undefined }, "partner_id"],
    ["a partner that is not an id", { partner_id: "abc" }, "partner_id"],
  ])("should refuse %s with a message on the field, and not call the database (AC04)", async (_name, change, field) => {
    const result = await generateSettlementAction(input(change));

    expect(result.success).toBe(false);
    expect(result.error).toMatchObject({ code: "VALIDATION_ERROR", field });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it.each([
    ["ST003", "CONFLICT"],
    ["ST004", "CONFLICT"],
    ["ST002", "VALIDATION_ERROR"],
    ["P0002", "NOT_FOUND"],
    ["42501", "FORBIDDEN"],
  ])("should map the database error %s to %s and not redirect", async (code, expected) => {
    rpcMock.mockResolvedValue({ data: null, error: { code, message: "raw database text" } });

    const result = await generateSettlementAction(input());

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(expected);
    expect(result.error?.message).not.toContain("raw database text");
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("should answer a generic error for a database error it does not know", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: "XX000", message: "boom" } });

    const result = await generateSettlementAction(input());

    expect(result.error?.code).toBe("INTERNAL_ERROR");
  });
});
