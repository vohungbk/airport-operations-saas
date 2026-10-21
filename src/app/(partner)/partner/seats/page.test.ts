import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.hoisted(() => vi.fn());
const getSeatsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/features/seats/lib/get-partner-seats", () => ({
  getPartnerSeats: getSeatsMock,
}));

import PartnerSeatsPage from "@/app/(partner)/partner/seats/page";

const USER = {
  id: "user-1",
  email: "partner@example.com",
  full_name: "Partner User",
  role: "partner_user" as const,
  partner_id: "partner-a",
  is_active: true,
};

const SEAT = {
  id: "s1",
  serial_number: "CS-0001",
  status: "available" as const,
  category: { name: "Toddler" },
  airport: { code: "DXB", name: "Dubai" },
};

async function render(raw: Record<string, string> = {}) {
  return renderToStaticMarkup(
    await PartnerSeatsPage({ searchParams: Promise.resolve(raw) }),
  );
}

describe("PartnerSeatsPage", () => {
  beforeEach(() => {
    requirePermissionMock.mockReset();
    requirePermissionMock.mockResolvedValue(USER);
    getSeatsMock.mockReset();
    getSeatsMock.mockResolvedValue({ seats: [SEAT], total: 1, page: 1 });
  });

  it("should guard the page with seats:view_own_partner", async () => {
    await render();

    expect(requirePermissionMock).toHaveBeenCalledWith("seats:view_own_partner");
  });

  it("should propagate the guard's redirect without reading any seat", async () => {
    requirePermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(render()).rejects.toThrow("REDIRECT:/forbidden");
    expect(getSeatsMock).not.toHaveBeenCalled();
  });

  it("should show the seats read-only, with a way back to the partner home", async () => {
    const html = await render();

    expect(html).toContain("CS-0001");
    expect(html).toContain('href="/partner"');
    expect(html).toContain("Back to Partner home");
    expect(html).not.toContain('href="/seats');
    expect(html).not.toContain("Add Seat");
  });

  it("should read the seats with the query from the address, dropping a partner or airport put there", async () => {
    await render({
      q: "cs",
      status: "available",
      partner_id: "partner-b",
      airport_id: "a0000000-0000-0000-0000-000000000001",
    });

    const query = getSeatsMock.mock.calls[0][0];
    expect(query).toMatchObject({ q: "cs", status: "available" });
    expect(query).not.toHaveProperty("partner_id");
    expect(query).not.toHaveProperty("airport_id");
  });

  it("should say there are no seats yet, not an error, when the partner has none", async () => {
    getSeatsMock.mockResolvedValue({ seats: [], total: 0, page: 1 });

    const html = await render();

    expect(html).toContain("No seats yet");
    expect(html).toContain("Back to Partner home");
  });

  it("should say nothing matched, and not that there are no seats, when a filter is active", async () => {
    getSeatsMock.mockResolvedValue({ seats: [], total: 0, page: 1 });

    expect(await render({ q: "zzz" })).toContain("No seats found");
  });

  it("should say the account is not linked and read nothing when partner_id is null", async () => {
    requirePermissionMock.mockResolvedValue({ ...USER, partner_id: null });

    const html = await render();

    expect(html).toContain("Your account is not linked to a partner yet");
    expect(html).toContain("Back to Partner home");
    expect(getSeatsMock).not.toHaveBeenCalled();
  });

  it("should let a failed read reach the error boundary instead of showing an empty list", async () => {
    getSeatsMock.mockRejectedValue(new Error("db down"));

    await expect(render()).rejects.toThrow("db down");
  });
});
