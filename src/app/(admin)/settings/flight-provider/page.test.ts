import { beforeEach, describe, expect, it, vi } from "vitest";

const requireRoleMock = vi.hoisted(() => vi.fn());
const getProviderStatusMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({
  requireRole: requireRoleMock,
}));

vi.mock("@/features/flights/lib/get-provider-status", () => ({
  getProviderStatus: getProviderStatusMock,
}));

import FlightProviderPage from "@/app/(admin)/settings/flight-provider/page";

describe("FlightProviderPage", () => {
  beforeEach(() => {
    requireRoleMock.mockReset();
    getProviderStatusMock.mockReset();
    getProviderStatusMock.mockResolvedValue({
      source: "simulator",
      last_synced_at: null,
      last_error: null,
    });
  });

  it("should guard the page for admin only and show the source status", async () => {
    requireRoleMock.mockResolvedValue({ role: "admin" });

    await FlightProviderPage();

    expect(requireRoleMock).toHaveBeenCalledWith(["admin"]);
    expect(getProviderStatusMock).toHaveBeenCalledTimes(1);
  });

  it("should propagate the guard's forbidden and not read the status", async () => {
    requireRoleMock.mockRejectedValue(new Error("FORBIDDEN"));

    await expect(FlightProviderPage()).rejects.toThrow("FORBIDDEN");
    expect(getProviderStatusMock).not.toHaveBeenCalled();
  });

  it("should let a failed status read reach the error boundary", async () => {
    requireRoleMock.mockResolvedValue({ role: "admin" });
    getProviderStatusMock.mockRejectedValue(new Error("Invalid flight source configuration"));

    await expect(FlightProviderPage()).rejects.toThrow("Invalid flight source configuration");
  });
});
