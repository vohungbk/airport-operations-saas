import { describe, expect, it, vi } from "vitest";

import {
  FAMILY_READY_CHECKS,
  getFamilyReadyState,
  installationBannerLine,
  isEveryCheckConfirmed,
  moveBookingToStep,
} from "@/features/installations/lib/family-ready";

describe("getFamilyReadyState", () => {
  it.each([
    ["en_route", "markable"],
    ["installed", "markable"],
    ["family_ready", "already"],
    ["in_progress", "already"],
    ["completed", "already"],
    ["assigned", "not_ready"],
    ["pending", "not_ready"],
  ] as const)("should return the state for a booking at %s", (status, expected) => {
    expect(getFamilyReadyState(status)).toBe(expected);
  });
});

describe("moveBookingToStep", () => {
  it("should move one step at a time and stop at the target", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });

    const error = await moveBookingToStep({ rpc }, "b-1", "en_route", "family_ready");

    expect(error).toBeNull();
    expect(rpc.mock.calls.map((call) => call[1].p_expected_status)).toEqual([
      "en_route",
      "installed",
    ]);
  });

  it("should return the first error and not move further", async () => {
    const failure = { code: "BK007" };
    const rpc = vi.fn().mockResolvedValue({ error: failure });

    const error = await moveBookingToStep({ rpc }, "b-1", "en_route", "family_ready");

    expect(error).toBe(failure);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("should not call the database when the booking is at the target", async () => {
    const rpc = vi.fn();

    expect(await moveBookingToStep({ rpc }, "b-1", "installed", "installed")).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("isEveryCheckConfirmed", () => {
  it("should be true only when all three confirmations are checked", () => {
    const keys = FAMILY_READY_CHECKS.map((check) => check.key);

    expect(isEveryCheckConfirmed(keys)).toBe(true);
    expect(isEveryCheckConfirmed(keys.slice(0, 2))).toBe(false);
    expect(isEveryCheckConfirmed([])).toBe(false);
  });
});

describe("installationBannerLine", () => {
  it("should write who, the date and the time in the airport zone", () => {
    expect(
      installationBannerLine("Omar Haddad", "2026-10-24T10:18:00Z", "Asia/Dubai"),
    ).toBe("Omar Haddad · 24 Oct 2026 · 14:18 GST");
  });

  it("should leave the person out when it is not known", () => {
    expect(installationBannerLine(null, "2026-10-24T10:18:00Z", "Asia/Dubai")).toBe(
      "24 Oct 2026 · 14:18 GST",
    );
  });
});
