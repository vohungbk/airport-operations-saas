import { isValidElement, type ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireRoleMock = vi.hoisted(() => vi.fn());
const getProviderStatusMock = vi.hoisted(() => vi.fn());
const getAirportMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({ requireRole: requireRoleMock }));
vi.mock("@/features/flights/lib/get-provider-status", () => ({
  getProviderStatus: getProviderStatusMock,
}));
vi.mock("@/features/flights/lib/simulator-lookup", () => ({
  getDefaultSimulatorAirport: getAirportMock,
}));
vi.mock("@/features/flights/components/flight-simulator-form", () => ({
  FlightSimulatorForm: () => null,
}));

import FlightSimulatorPage from "@/app/(admin)/settings/flight-simulator/page";

type FormProps = { enabled: boolean; airport: { code: string; name: string; timezone: string } | null };
type PageTree = ReactElement<{ children: [ReactElement<{ children: [unknown, ReactElement<{ children: string }> | false] }>, ReactElement<FormProps>] }>;

/** The props the page gives the form. */
function formPropsOf(page: PageTree): FormProps {
  return page.props.children[1].props;
}

/** The airport line under the title. */
function lineOf(page: PageTree): string | undefined {
  const line = page.props.children[0].props.children[1];
  return line ? line.props.children : undefined;
}

describe("FlightSimulatorPage", () => {
  beforeEach(() => {
    requireRoleMock.mockReset();
    requireRoleMock.mockResolvedValue({ role: "admin" });
    getProviderStatusMock.mockReset();
    getProviderStatusMock.mockResolvedValue({ source: "simulator", last_synced_at: null, last_error: null });
    getAirportMock.mockReset();
    getAirportMock.mockResolvedValue({ code: "DXB", name: "Dubai International Airport", timezone: "Asia/Dubai" });
  });

  it("should guard the page for admin only and turn the form on when the source is the simulator", async () => {
    const page = await FlightSimulatorPage();

    expect(requireRoleMock).toHaveBeenCalledWith(["admin"]);
    expect(isValidElement(page)).toBe(true);
    expect(formPropsOf(page as PageTree).enabled).toBe(true);
  });

  it("should give the form the default airport and show its code, name, date and time zone under the title", async () => {
    const page = (await FlightSimulatorPage()) as PageTree;

    expect(formPropsOf(page).airport).toEqual({ code: "DXB", name: "Dubai International Airport", timezone: "Asia/Dubai" });
    expect(lineOf(page)).toMatch(/^DXB · Dubai International Airport · \d{1,2} \w{3} \d{4} · Asia\/Dubai \(GST, UTC\+4\)$/);
  });

  it("should show no airport line when the viewer sees no airport", async () => {
    getAirportMock.mockResolvedValue(null);

    const page = (await FlightSimulatorPage()) as PageTree;

    expect(lineOf(page)).toBeUndefined();
    expect(formPropsOf(page).airport).toBeNull();
  });

  it("should turn the form off when the active source is not the simulator", async () => {
    getProviderStatusMock.mockResolvedValue({ source: "provider", last_synced_at: null, last_error: null });

    const page = await FlightSimulatorPage();

    expect(formPropsOf(page as PageTree).enabled).toBe(false);
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
