import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAnyPermissionMock = vi.hoisted(() => vi.fn());
const getReturnChainItemMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({
  requireAnyPermission: requireAnyPermissionMock,
}));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  forbidden: vi.fn(() => {
    throw new Error("FORBIDDEN");
  }),
}));

vi.mock("@/features/return-queue/lib/get-return-queue", () => ({
  getReturnChainItem: getReturnChainItemMock,
}));

vi.mock("@/features/return-queue/actions/complete-chain-step.action", () => ({
  completeChainStepAction: vi.fn(),
}));

import ReturnChainStepPage from "@/app/(dashboard)/return-queue/[bookingId]/page";
import { RETURN_CHAIN_STEP_PERMISSIONS } from "@/lib/auth/permissions";
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
      chain_steps: [],
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
    requireAnyPermissionMock.mockReset();
    requireAnyPermissionMock.mockResolvedValue({ id: "u-1", role: "operations_manager" });
    getReturnChainItemMock.mockReset();
    getReturnChainItemMock.mockResolvedValue(item("cleaning", "cleaning"));
  });

  it("should guard the page with the manager or the technician permission", async () => {
    await render();

    expect(requireAnyPermissionMock).toHaveBeenCalledWith(RETURN_CHAIN_STEP_PERMISSIONS);
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

  it("should show the form of the current step with its checklist, notes, photo and actions", async () => {
    const html = await render();

    expect(html).toContain("Result *");
    expect(html).toContain("Shell cleaned");
    expect(html).toContain("Required when result is Fail");
    expect(html).toContain("Photo evidence *");
    expect(html).toContain("Complete step");
    expect(html).toMatch(/<a[^>]*href="\/return-queue"[^>]*>Cancel<\/a>/);
  });

  it("should show the failed step of a quarantined seat, with no step to record", async () => {
    getReturnChainItemMock.mockResolvedValue(item("quarantine", "inspection"));

    const html = await render();

    expect(html).toContain("Final inspection · Step 6 of 7");
    expect(html).toContain("Failed");
    expect(html).not.toContain("Complete step");
  });

  it("should show not found, with no booking data, for a seat outside the chain or the user's scope", async () => {
    getReturnChainItemMock.mockResolvedValue(null);

    const html = await render("other");

    expect(html).toContain("Seat not in the return queue");
    expect(html).toContain('href="/return-queue"');
    expect(html).not.toContain("BK-2026-000123");
  });

  it("should show the assigned technician their step with Cancel leading to their home (FO-F08-S08)", async () => {
    requireAnyPermissionMock.mockResolvedValue({ id: "t-1", role: "technician" });

    const html = await render();

    expect(html).toContain("Technician · Assigned work · DXB");
    expect(html).toContain("Complete step");
    expect(html).toMatch(/<a[^>]*href="\/technician"[^>]*>Cancel<\/a>/);
  });

  it("should show the forbidden state to a technician for a booking not assigned to them (E6)", async () => {
    requireAnyPermissionMock.mockResolvedValue({ id: "t-1", role: "technician" });
    getReturnChainItemMock.mockResolvedValue(null);

    await expect(render("other")).rejects.toThrow("FORBIDDEN");
  });
});
