import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.hoisted(() => vi.fn());
const getReturnChainItemMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/features/return-queue/lib/get-return-queue", () => ({
  getReturnChainItem: getReturnChainItemMock,
}));

import ReturnChainStepPage from "@/app/(dashboard)/return-queue/[bookingId]/page";
import { toReturnQueueItem } from "@/features/return-queue/lib/return-queue";

const NOW = new Date("2026-11-04T07:30:00Z");

function item(seatStatus: "cleaning" | "quarantine", status: "cleaning" | "inspection") {
  return toReturnQueueItem(
    {
      id: "b-1",
      booking_number: "BK-2026-000123",
      status,
      airport: { code: "DXB", timezone: "Asia/Dubai" },
      partner: { name: "Emirates Rent A Car" },
      seat: { id: "s-1", serial_number: "SEAT-0001", status: seatStatus },
      events: [{ to_status: status, created_at: "2026-11-04T07:10:00Z" }],
    },
    NOW,
  );
}

async function render(bookingId = "b-1") {
  return renderToStaticMarkup(
    await ReturnChainStepPage({ params: Promise.resolve({ bookingId }) }),
  );
}

describe("ReturnChainStepPage", () => {
  beforeEach(() => {
    requirePermissionMock.mockReset();
    requirePermissionMock.mockResolvedValue({ id: "u-1", role: "operations_manager" });
    getReturnChainItemMock.mockReset();
    getReturnChainItemMock.mockResolvedValue(item("cleaning", "cleaning"));
  });

  it("should guard the page with the manager permission", async () => {
    await render();

    expect(requirePermissionMock).toHaveBeenCalledWith("dashboards:view");
  });

  it("should show the chain with the current step of the seat", async () => {
    const html = await render();

    expect(getReturnChainItemMock).toHaveBeenCalledWith("b-1", expect.any(Date));
    expect(html).toContain("Return chain · Active step");
    expect(html).toContain("Operations Manager · Full access · DXB");
    expect(html).toContain(
      "SEAT-0001 · BK-2026-000123 · Emirates Rent A Car · 04 Nov 2026, 11:10 GST",
    );
    expect(html).toContain("Cleaning · Step 3 of 7");
    expect(html).toContain("Current step");
    expect(html).toContain("Locked");
  });

  it("should show the failed step of a quarantined seat", async () => {
    getReturnChainItemMock.mockResolvedValue(item("quarantine", "inspection"));

    const html = await render();

    expect(html).toContain("Final inspection · Step 6 of 7");
    expect(html).toContain("Failed");
  });

  it("should show not found, with no booking data, for a seat outside the chain or the user's scope", async () => {
    getReturnChainItemMock.mockResolvedValue(null);

    const html = await render("other");

    expect(html).toContain("Seat not in the return queue");
    expect(html).toContain('href="/return-queue"');
    expect(html).not.toContain("BK-2026-000123");
  });
});
