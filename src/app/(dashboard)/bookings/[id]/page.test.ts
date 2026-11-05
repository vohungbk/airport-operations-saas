import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAnyPermissionMock = vi.hoisted(() => vi.fn());
const getBookingByIdMock = vi.hoisted(() => vi.fn());
const getBookingEventsMock = vi.hoisted(() => vi.fn());
const getFlightUpdatesMock = vi.hoisted(() => vi.fn());
const notFoundMock = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
);

vi.mock("@/lib/auth/current-user", () => ({
  requireAnyPermission: requireAnyPermissionMock,
}));

vi.mock("@/features/bookings/lib/get-booking-by-id", () => ({
  getBookingById: getBookingByIdMock,
}));

vi.mock("@/features/bookings/lib/get-booking-events", () => ({
  getBookingEvents: getBookingEventsMock,
}));

vi.mock("@/features/flights/lib/get-flight-updates", () => ({
  getFlightUpdates: getFlightUpdatesMock,
}));

vi.mock("next/navigation", () => ({ notFound: notFoundMock }));

import BookingDetailPage from "@/app/(dashboard)/bookings/[id]/page";

const ID = "f0000000-0000-4000-8000-000000000001";

describe("BookingDetailPage", () => {
  beforeEach(() => {
    requireAnyPermissionMock.mockReset();
    requireAnyPermissionMock.mockResolvedValue({ role: "partner_user" });
    getBookingByIdMock.mockReset();
    getBookingEventsMock.mockReset();
    getBookingEventsMock.mockResolvedValue({ items: [], truncated: false });
    getFlightUpdatesMock.mockReset();
    getFlightUpdatesMock.mockResolvedValue(null);
  });

  it("should guard the page with either booking permission", async () => {
    getBookingByIdMock.mockResolvedValue({ id: ID });

    await BookingDetailPage({ params: Promise.resolve({ id: ID }) });

    expect(requireAnyPermissionMock).toHaveBeenCalledWith([
      "bookings:manage",
      "bookings:view_own_partner",
    ]);
  });

  it.each([
    ["flight", "flight"],
    ["timeline", "timeline"],
    ["workflow", "overview"],
    ["nonsense", "overview"],
  ])("should open the %s tab as %s (the tab bar of the workflow page links here)", async (tab, expected) => {
    getBookingByIdMock.mockResolvedValue({ id: ID });

    const element = await BookingDetailPage({
      params: Promise.resolve({ id: ID }),
      searchParams: Promise.resolve({ tab }),
    });

    expect((element as { props: { defaultTab: string } }).props.defaultTab).toBe(expected);
  });

  it("should open Overview when the address has no tab", async () => {
    getBookingByIdMock.mockResolvedValue({ id: ID });

    const element = await BookingDetailPage({ params: Promise.resolve({ id: ID }) });

    expect((element as { props: { defaultTab: string } }).props.defaultTab).toBe("overview");
  });

  it("should call notFound when the booking is missing or hidden by RLS", async () => {
    getBookingByIdMock.mockResolvedValue(null);

    await expect(
      BookingDetailPage({ params: Promise.resolve({ id: ID }) }),
    ).rejects.toThrow("NOT_FOUND");
  });

  it.each([
    ["admin", true],
    ["operations_manager", true],
    ["partner_user", true],
    ["technician", false],
  ])("should offer the revenue to %s: %s (VI-F04-S08)", async (role, expected) => {
    requireAnyPermissionMock.mockResolvedValue({ role });
    getBookingByIdMock.mockResolvedValue({ id: ID });

    const element = await BookingDetailPage({ params: Promise.resolve({ id: ID }) });

    expect((element as { props: { canViewRevenue: boolean } }).props.canViewRevenue).toBe(expected);
  });

  it("should pass the history of the booking's flight to the page (VI-F02-T01)", async () => {
    const history = { items: [], error: false };
    getBookingByIdMock.mockResolvedValue({ id: ID, flight_id: "flight-1" });
    getFlightUpdatesMock.mockResolvedValue(history);

    const element = await BookingDetailPage({ params: Promise.resolve({ id: ID }) });

    expect(getFlightUpdatesMock).toHaveBeenCalledWith("flight-1");
    expect((element as { props: { flightHistory: unknown } }).props.flightHistory).toBe(history);
  });

  it("should still open the page, with the error of the history, when the history cannot load (VI-F02-T01 AC05)", async () => {
    const history = { items: [], error: true };
    getBookingByIdMock.mockResolvedValue({ id: ID, flight_id: "flight-1" });
    getFlightUpdatesMock.mockResolvedValue(history);

    const element = await BookingDetailPage({ params: Promise.resolve({ id: ID }) });

    expect((element as { props: { flightHistory: unknown } }).props.flightHistory).toEqual(history);
  });

  it("should give no history for a booking with no linked flight", async () => {
    getBookingByIdMock.mockResolvedValue({ id: ID, flight_id: null });

    const element = await BookingDetailPage({ params: Promise.resolve({ id: ID }) });

    expect(getFlightUpdatesMock).toHaveBeenCalledWith(null);
    expect((element as { props: { flightHistory: unknown } }).props.flightHistory).toBeNull();
  });

  it("should not read the history of a booking that is not found", async () => {
    getBookingByIdMock.mockResolvedValue(null);

    await expect(BookingDetailPage({ params: Promise.resolve({ id: ID }) })).rejects.toThrow("NOT_FOUND");
    expect(getFlightUpdatesMock).not.toHaveBeenCalled();
  });

  it("should propagate the guard's redirect", async () => {
    requireAnyPermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(
      BookingDetailPage({ params: Promise.resolve({ id: ID }) }),
    ).rejects.toThrow("REDIRECT:/forbidden");
    expect(getBookingByIdMock).not.toHaveBeenCalled();
  });
});
