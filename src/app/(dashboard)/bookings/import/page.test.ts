import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAnyPermissionMock = vi.hoisted(() => vi.fn());
const getFormOptionsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({ requireAnyPermission: requireAnyPermissionMock }));
vi.mock("@/features/bookings/lib/get-booking-form-options", () => ({
  getBookingFormOptions: getFormOptionsMock,
}));

import ImportBookingsPage from "@/app/(dashboard)/bookings/import/page";

const render = async () => renderToStaticMarkup(await ImportBookingsPage());
const asRole = (role: string) => requireAnyPermissionMock.mockResolvedValue({ id: "u-1", role });

/** CO-F07-S01: the import screen, in the Empty and the Permission denied states of the design. */
describe("ImportBookingsPage", () => {
  beforeEach(() => {
    requireAnyPermissionMock.mockReset();
    getFormOptionsMock.mockReset();
    getFormOptionsMock.mockResolvedValue({ partners: [{ value: "p-1", label: "Emirates Rent A Car" }] });
  });

  it("should guard the page with either booking permission", async () => {
    asRole("operations_manager");

    await render();

    expect(requireAnyPermissionMock).toHaveBeenCalledWith(["bookings:manage", "bookings:view_own_partner"]);
  });

  it("should show an operations manager the upload card with the template link and Validate file off", async () => {
    asRole("operations_manager");

    const html = await render();

    expect(html).toContain("Import bookings");
    expect(html).toContain("Upload a booking file");
    expect(html).toContain('href="/api/bookings/import-template"');
    expect(html).toContain("Download template");
    expect(html).toContain('type="file"');
    expect(html).toContain('accept=".csv,text/csv"');
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Validate file<\/button>/);
    expect(html).toContain('href="/bookings"');
    expect(html).not.toContain("do not have permission");
  });

  it("should show an admin the upload card", async () => {
    asRole("admin");

    expect(await render()).toContain("Upload a booking file");
  });

  it("should show a partner user the permission denied state and load no partners", async () => {
    asRole("partner_user");

    const html = await render();

    expect(html).toContain("You do not have permission to import bookings");
    expect(html).toContain("Back to bookings");
    expect(html).not.toContain("Upload a booking file");
    expect(html).not.toContain("Download template");
    expect(getFormOptionsMock).not.toHaveBeenCalled();
  });

  it("should propagate the guard's refusal and load no partners", async () => {
    requireAnyPermissionMock.mockRejectedValue(new Error("FORBIDDEN"));

    await expect(ImportBookingsPage()).rejects.toThrow("FORBIDDEN");
    expect(getFormOptionsMock).not.toHaveBeenCalled();
  });
});
