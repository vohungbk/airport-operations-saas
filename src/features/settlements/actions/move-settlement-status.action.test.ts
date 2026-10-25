import { beforeEach, describe, expect, it, vi } from "vitest";

const requireRoleMock = vi.hoisted(() => vi.fn());
const rpcMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({ requireRole: requireRoleMock }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc: rpcMock }) }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

import { moveSettlementStatusAction } from "@/features/settlements/actions/move-settlement-status.action";

const ID = "e0000000-0000-0000-0000-000000000001";
const input = (change: Record<string, unknown> = {}) => ({ settlement_id: ID, to_status: "approved", ...change });

describe("moveSettlementStatusAction", () => {
  beforeEach(() => {
    requireRoleMock.mockReset();
    requireRoleMock.mockResolvedValue({ id: "u-1", role: "admin" });
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({ data: {}, error: null });
    revalidatePathMock.mockClear();
  });

  it("should move the settlement through the database function and refresh the list (AC01)", async () => {
    const result = await moveSettlementStatusAction(input());

    expect(result).toEqual({ success: true });
    expect(rpcMock).toHaveBeenCalledWith("move_settlement_status", { p_settlement_id: ID, p_to: "approved" });
    expect(revalidatePathMock).toHaveBeenCalledWith("/settlements");
  });

  it("should check the role before anything else, and allow admin only", async () => {
    requireRoleMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(moveSettlementStatusAction(input())).rejects.toThrow("REDIRECT:/forbidden");
    expect(requireRoleMock).toHaveBeenCalledWith(["admin"]);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it.each([
    ["a status that is not in the list", { to_status: "closed" }],
    ["a missing status", { to_status: undefined }],
    ["an id that is not an id", { settlement_id: "abc" }],
  ])("should refuse %s and not call the database", async (_name, change) => {
    const result = await moveSettlementStatusAction(input(change));

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("VALIDATION_ERROR");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it.each([
    ["ST006", "CONFLICT"],
    ["P0002", "NOT_FOUND"],
    ["42501", "FORBIDDEN"],
    ["XX000", "INTERNAL_ERROR"],
  ])("should map the database error %s to %s and not refresh the list", async (code, expected) => {
    rpcMock.mockResolvedValue({ data: null, error: { code, message: "raw database text" } });

    const result = await moveSettlementStatusAction(input());

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(expected);
    expect(result.error?.message).not.toContain("raw database text");
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});
