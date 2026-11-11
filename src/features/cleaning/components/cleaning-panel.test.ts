import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const startHookMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/cleaning/hooks/use-start-cleaning", () => ({
  useStartCleaning: startHookMock,
}));
vi.mock("@/features/cleaning/components/cleaning-complete-dialog", () => ({
  CleaningCompleteDialog: () => "COMPLETE-DIALOG",
}));

import { CleaningPanel } from "@/features/cleaning/components/cleaning-panel";
import type { CleaningPanelView } from "@/features/cleaning/lib/build-cleaning-panel-view";

const BASE: CleaningPanelView = {
  state: "not_started",
  jobId: "j-1",
  seatSerial: "SEAT-0001",
  seatStatus: "available",
  lastCleaning: "03 Nov 2026 17:20 GST · Success",
  startedLine: null,
  completedLine: null,
  failedLine: null,
  recordedLine: null,
  conflict: null,
};

function render(view: Partial<CleaningPanelView>) {
  return renderToStaticMarkup(createElement(CleaningPanel, { view: { ...BASE, ...view } }));
}

describe("CleaningPanel", () => {
  beforeEach(() => {
    startHookMock.mockReset();
    startHookMock.mockReturnValue({ start: vi.fn(), isPending: false, result: null, viewCleaning: vi.fn() });
  });

  it("should offer Start cleaning and the last cleaning result when not started", () => {
    const html = render({});

    expect(html).toContain("Start cleaning");
    expect(html).toContain("Last cleaning: 03 Nov 2026 17:20 GST · Success");
    expect(html).not.toContain("COMPLETE-DIALOG");
  });

  it("should show who started, when and the elapsed time, with Complete cleaning, while in progress", () => {
    const html = render({
      state: "in_progress",
      seatStatus: "cleaning",
      startedLine: "Started by Omar Haddad at 04 Nov 2026 11:00 GST. Elapsed 18 min.",
    });

    expect(html).toContain("Started by Omar Haddad");
    expect(html).toContain("COMPLETE-DIALOG");
    expect(html).not.toContain("Start cleaning");
  });

  it("should disable Start with the booking link and period when a booking holds the seat", () => {
    const html = render({
      state: "blocked",
      seatStatus: "reserved",
      conflict: { bookingId: "b-9", bookingNumber: "BK-2026-000123", period: "04 Nov 2026 09:00 GST - 04 Nov 2026 17:00 GST" },
    });

    expect(html).toContain("This seat is booked in this period");
    expect(html).toContain('href="/bookings/b-9"');
    expect(html).toContain("04 Nov 2026 09:00 GST - 04 Nov 2026 17:00 GST");
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Start cleaning - blocked/);
  });

  it("should show the Quarantine badge, the reason and Create incident after a failed cleaning", () => {
    const html = render({
      state: "failed",
      seatStatus: "quarantine",
      failedLine: "Result: Failed. Quarantine reason: persistent contamination on harness.",
    });

    expect(html).toContain("Quarantine");
    expect(html).toContain("persistent contamination on harness");
    expect(html).toContain('href="/incidents/new?job_id=j-1"');
    expect(html).not.toContain("Start cleaning");
  });

  it("should confirm the seat is Available after a passed cleaning, with no action", () => {
    const html = render({
      state: "completed_passed",
      completedLine: "Cleaning completed by Omar Haddad at 04 Nov 2026 11:18 GST.",
    });

    expect(html).toContain("Cleaning complete. Seat is Available.");
    expect(html).not.toContain("Start cleaning");
    expect(html).not.toContain("COMPLETE-DIALOG");
  });

  it("should show the error and keep Start when the start fails", () => {
    startHookMock.mockReturnValue({
      start: vi.fn(),
      isPending: false,
      result: { success: false, error: { code: "SEAT_IN_USE", message: "Another booking holds or uses the seat now or soon." } },
      viewCleaning: vi.fn(),
    });

    const html = render({});

    expect(html).toContain("Another booking holds or uses the seat");
    expect(html).toContain("Start cleaning");
  });
});
