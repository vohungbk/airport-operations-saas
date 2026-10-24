import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requireRoleMock = vi.hoisted(() => vi.fn());
const rpcMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({ requireRole: requireRoleMock }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc: rpcMock }),
}));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

import { saveCommercialTermsAction } from "@/features/partners/actions/save-commercial-terms.action";

const PARTNER_ID = "a0000000-0000-0000-0000-000000000001";
const TODAY = "2026-10-24";

const input = (change: Record<string, unknown> = {}) => ({
  partner_share_percent: 35,
  launch_partner_share_percent: 55,
  launch_credit_target: 10000,
  annual_fee: 1200,
  onboarding_fee: 300.5,
  vat_rate_percent: 7.5,
  payment_terms_days: 30,
  effective_from: TODAY,
  ...change,
});

describe("saveCommercialTermsAction", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${TODAY}T10:00:00Z`));
    requireRoleMock.mockReset();
    requireRoleMock.mockResolvedValue({ id: "u-1", role: "admin" });
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({ data: {}, error: null });
    revalidatePathMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should save the terms through the database function and refresh the screen (AC05, AC06)", async () => {
    await expect(saveCommercialTermsAction(PARTNER_ID, input())).resolves.toEqual({ success: true });

    expect(rpcMock).toHaveBeenCalledWith("set_partner_commercial_terms", {
      p_partner_id: PARTNER_ID,
      p_partner_share: 35,
      p_launch_partner_share: 55,
      p_effective_from: TODAY,
      p_launch_credit_target: 10000,
      p_annual_fee: 1200,
      p_onboarding_fee: 300.5,
      p_vat_rate: 7.5,
      p_payment_terms_days: 30,
    });
    expect(revalidatePathMock).toHaveBeenCalledWith(`/partners/${PARTNER_ID}/terms`);
  });

  it("should check that the caller is an admin before anything else (AC02)", async () => {
    requireRoleMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(saveCommercialTermsAction(PARTNER_ID, input())).rejects.toThrow("REDIRECT:/forbidden");
    expect(requireRoleMock).toHaveBeenCalledWith([]);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it.each([
    ["a partner share above 100", { partner_share_percent: 101 }],
    ["a launch share below the partner share", { launch_partner_share_percent: 34 }],
    ["a date in the past", { effective_from: "2026-10-23" }],
    ["a missing share", { partner_share_percent: undefined }],
    ["a share sent as text", { partner_share_percent: "35" }],
    ["a negative launch target", { launch_credit_target: -1 }],
    ["a negative fee", { annual_fee: -0.01 }],
    ["a fee with 3 decimals", { onboarding_fee: 1.005 }],
    ["a VAT rate above 100", { vat_rate_percent: 100.01 }],
    ["payment terms with a decimal", { payment_terms_days: 14.5 }],
    ["negative payment terms", { payment_terms_days: -1 }],
    ["a missing fee", { annual_fee: undefined }],
  ])("should answer a validation error and not call the database for %s (AC03, AC04)", async (_name, change) => {
    const result = await saveCommercialTermsAction(PARTNER_ID, input(change));

    expect(result).toEqual({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Check the form and try again." },
    });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("should send no launch target when the field is empty (AC02)", async () => {
    await saveCommercialTermsAction(PARTNER_ID, input({ launch_credit_target: null }));

    expect(rpcMock.mock.calls[0][1]).toMatchObject({ p_launch_credit_target: null });
  });

  it.each([
    ["TC005", "launch_credit_target"],
    ["TC006", "annual_fee"],
    ["TC007", "vat_rate_percent"],
    ["TC008", "payment_terms_days"],
  ])("should show the database error %s under the field %s", async (code, field) => {
    rpcMock.mockResolvedValue({ data: null, error: { code, message: "raw" } });

    const result = await saveCommercialTermsAction(PARTNER_ID, input());

    expect(result.error).toMatchObject({ code: "VALIDATION_ERROR", field });
  });

  it("should answer a validation error for an id that is not an id", async () => {
    const result = await saveCommercialTermsAction("not-an-id", input());

    expect(result.error?.code).toBe("VALIDATION_ERROR");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("should use the date of the server, so a stale date from the browser is refused", async () => {
    vi.setSystemTime(new Date("2026-10-25T00:00:01Z"));

    const result = await saveCommercialTermsAction(PARTNER_ID, input());

    expect(result.error?.code).toBe("VALIDATION_ERROR");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it.each([
    ["42501", "FORBIDDEN"],
    ["P0002", "NOT_FOUND"],
    ["TC001", "VALIDATION_ERROR"],
    ["TC004", "CONFLICT"],
    ["XX000", "INTERNAL_ERROR"],
  ])("should map the database error %s to %s and not refresh the screen", async (code, mapped) => {
    rpcMock.mockResolvedValue({ data: null, error: { code, message: "raw database text" } });

    const result = await saveCommercialTermsAction(PARTNER_ID, input());

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(mapped);
    expect(result.error?.message).not.toContain("raw database text");
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});
