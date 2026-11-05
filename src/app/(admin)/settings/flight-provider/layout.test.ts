import { beforeEach, describe, expect, it, vi } from "vitest";

const requireRoleMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({
  requireRole: requireRoleMock,
}));

import FlightProviderLayout from "@/app/(admin)/settings/flight-provider/layout";

describe("FlightProviderLayout", () => {
  beforeEach(() => {
    requireRoleMock.mockReset();
  });

  it("should guard the area so that only an admin passes", async () => {
    requireRoleMock.mockResolvedValue({ role: "admin" });

    await FlightProviderLayout({ children: null });

    expect(requireRoleMock).toHaveBeenCalledWith(["admin"]);
  });

  it("should propagate the guard's forbidden instead of swallowing it", async () => {
    requireRoleMock.mockRejectedValue(new Error("FORBIDDEN"));

    await expect(FlightProviderLayout({ children: null })).rejects.toThrow("FORBIDDEN");
  });
});
