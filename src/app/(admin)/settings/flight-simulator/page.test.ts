import { isValidElement, type ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireRoleMock = vi.hoisted(() => vi.fn());
const getProviderStatusMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({ requireRole: requireRoleMock }));
vi.mock("@/features/flights/lib/get-provider-status", () => ({
  getProviderStatus: getProviderStatusMock,
}));
vi.mock("@/features/flights/components/flight-simulator-form", () => ({
  FlightSimulatorForm: () => null,
}));

import FlightSimulatorPage from "@/app/(admin)/settings/flight-simulator/page";

/** The `enabled` prop the page gives the form. */
function enabledOf(page: ReactElement<{ children: ReactElement[] }>): unknown {
  const wrapper = page.props.children[1] as ReactElement<{ children: ReactElement<{ enabled: boolean }> }>;
  return wrapper.props.children.props.enabled;
}

describe("FlightSimulatorPage", () => {
  beforeEach(() => {
    requireRoleMock.mockReset();
    requireRoleMock.mockResolvedValue({ role: "admin" });
    getProviderStatusMock.mockReset();
    getProviderStatusMock.mockResolvedValue({ source: "simulator", last_synced_at: null, last_error: null });
  });

  it("should guard the page for admin only and turn the form on when the source is the simulator", async () => {
    const page = await FlightSimulatorPage();

    expect(requireRoleMock).toHaveBeenCalledWith(["admin"]);
    expect(isValidElement(page)).toBe(true);
    expect(enabledOf(page as ReactElement<{ children: ReactElement[] }>)).toBe(true);
  });

  it("should turn the form off when the active source is not the simulator", async () => {
    getProviderStatusMock.mockResolvedValue({ source: "provider", last_synced_at: null, last_error: null });

    const page = await FlightSimulatorPage();

    expect(enabledOf(page as ReactElement<{ children: ReactElement[] }>)).toBe(false);
  });

  it("should propagate the guard's forbidden and not read the status", async () => {
    requireRoleMock.mockRejectedValue(new Error("FORBIDDEN"));

    await expect(FlightSimulatorPage()).rejects.toThrow("FORBIDDEN");
    expect(getProviderStatusMock).not.toHaveBeenCalled();
  });

  it("should let a failed status read reach the error boundary", async () => {
    getProviderStatusMock.mockRejectedValue(new Error("Invalid flight source configuration"));

    await expect(FlightSimulatorPage()).rejects.toThrow("Invalid flight source configuration");
  });
});
