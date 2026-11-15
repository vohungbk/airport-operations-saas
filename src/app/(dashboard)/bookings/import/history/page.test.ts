import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAnyPermissionMock = vi.hoisted(() => vi.fn());
const getImportsMock = vi.hoisted(() => vi.fn());
const getOptionsMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/auth/current-user", () => ({ requireAnyPermission: requireAnyPermissionMock }));
vi.mock("@/features/bookings/lib/get-booking-imports", () => ({
  getBookingImports: getImportsMock,
  getBookingImportFilterOptions: getOptionsMock,
}));

import ImportHistoryPage from "@/app/(dashboard)/bookings/import/history/page";

const item = (id: string, file: string, created: number, rejected: number) => ({
  id,
  file_name: file,
  partner_name: "Emirates Rent A Car",
  actor_name: "Priya Nair",
  created_at: "2026-10-24T06:42:00Z",
  created_rows: created,
  rejected_rows: rejected,
});

const render = async (searchParams: Record<string, string> = {}) =>
  renderToStaticMarkup(await ImportHistoryPage({ searchParams: Promise.resolve(searchParams) }));
const asRole = (role: string) => requireAnyPermissionMock.mockResolvedValue({ id: "u-1", role });

/** CO-F07-S07: the Import history screen, in the Success, Empty and Permission denied states of the design. */
describe("ImportHistoryPage", () => {
  beforeEach(() => {
    requireAnyPermissionMock.mockReset();
    getImportsMock.mockReset();
    getOptionsMock.mockReset();
    getOptionsMock.mockResolvedValue({ partners: [], actors: [] });
    getImportsMock.mockResolvedValue({
      items: [item("i-1", "bookings-oct-week4.csv", 128, 0), item("i-2", "al-futtaim-oct.csv", 94, 6), item("i-3", "week3.csv", 0, 40)],
      total: 3,
      page: 1,
      timezone: "Asia/Dubai",
    });
  });

  it("should list the imports with their result and a way back to the import screen", async () => {
    asRole("operations_manager");

    const html = await render();

    expect(html).toContain("Import register");
    expect(html).toContain("bookings-oct-week4.csv");
    expect(html).toContain("Priya Nair");
    expect(html).toContain("Completed");
    expect(html).toContain("Completed with rejects");
    expect(html).toContain("Failed");
    expect(html).toContain("1–3 of 3 imports");
    expect(html).toContain("Import history is kept and cannot be deleted.");
    expect(html).toContain('href="/bookings/import"');
    expect(html).toContain("Back to import bookings");
  });

  it("should show the empty state with a New import button when nothing was imported", async () => {
    asRole("admin");
    getImportsMock.mockResolvedValue({ items: [], total: 0, page: 1, timezone: "UTC" });

    const html = await render();

    expect(html).toContain("No imports yet");
    expect(html).toContain("New import");
    expect(html).not.toContain("<table");
  });

  it("should show a partner user the permission denied state and read no import", async () => {
    asRole("partner_user");

    const html = await render();

    expect(html).toContain("You do not have permission to import bookings");
    expect(getImportsMock).not.toHaveBeenCalled();
    expect(getOptionsMock).not.toHaveBeenCalled();
  });

  it("should read the filters from the address and fall back to the defaults when they are garbled", async () => {
    asRole("operations_manager");

    await render({ period: "7d", partner_id: "not-a-guid" });

    expect(getImportsMock).toHaveBeenCalledWith({ period: "7d", page: 1 });
  });

  it("should propagate the guard's refusal and read no import", async () => {
    requireAnyPermissionMock.mockRejectedValue(new Error("FORBIDDEN"));

    await expect(render()).rejects.toThrow("FORBIDDEN");
    expect(getImportsMock).not.toHaveBeenCalled();
  });
});
