import { beforeEach, describe, expect, it, vi } from "vitest";

const requireRoleMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({
  requireRole: requireRoleMock,
}));

import FlightSimulatorLayout from "@/app/(admin)/settings/flight-simulator/layout";

describe("FlightSimulatorLayout", () => {
  beforeEach(() => {
    requireRoleMock.mockReset();
  });

  it("should guard the area so that only an admin passes", async () => {
    requireRoleMock.mockResolvedValue({ role: "admin" });

    await FlightSimulatorLayout({ children: null });

    expect(requireRoleMock).toHaveBeenCalledWith(["admin"]);
  });

  it("should show a permission denied state to an operations manager by propagating the 403", async () => {
    requireRoleMock.mockRejectedValue(new Error("FORBIDDEN"));

    await expect(FlightSimulatorLayout({ children: null })).rejects.toThrow("FORBIDDEN");
  });
});
