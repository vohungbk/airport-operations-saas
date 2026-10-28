import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/installations/actions/verify-seat-scan.action", () => ({
  verifySeatScanAction: vi.fn(),
}));

import { SeatScanFlow } from "@/features/installations/components/seat-scan-flow";
import { SeatScanResult } from "@/features/installations/components/seat-scan-result";
import type { SeatScanView } from "@/features/installations/lib/seat-scan-result";

const html = (element: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(element);

const scan = (overrides: Partial<SeatScanView> = {}): SeatScanView => ({
  match: true,
  assigned: { serial_number: "SEAT-0001", category_name: "Convertible", airport_code: "DXB" },
  scanned: { serial_number: "SEAT-0001", category_name: "Convertible", status: "reserved" },
  checks: {
    last_cleaning: { at: "2026-10-24T09:20:00Z", passed: true },
    last_inspection: { at: "2026-10-24T09:45:00Z", result: "pass" },
  },
  ...overrides,
});

const renderResult = (view: SeatScanView, reportHref: string | null = "/incidents/new?job_id=j-1") =>
  html(
    createElement(SeatScanResult, {
      scan: view,
      timeZone: "Asia/Dubai",
      continueHref: "/jobs/j-1/installation",
      reportHref,
      onScanAgain: () => undefined,
    }),
  );

describe("Seat scan: the scanner screen", () => {
  const out = html(
    createElement(SeatScanFlow, {
      jobId: "j-1",
      bookingNumber: "BK-2026-000123",
      timeZone: "Asia/Dubai",
      assignedSerial: "SEAT-0001",
      reportHref: null,
    }),
  );

  it("should show the heading, the camera frame and the lines of the design", () => {
    expect(out).toContain("Scan seat QR");
    expect(out).toContain("— · BK-2026-000123 · Asia/Dubai");
    expect(out).toContain("Align seat QR inside the frame");
    expect(out).toContain("Camera preview · QR scan only opens the seat");
    expect(out).toContain("Type code instead");
    expect(out).toContain("Expected seat SEAT-0001");
    expect(out).toContain("Sign-in and permission required for actions.");
  });

  it("should not offer the torch until the phone says it has one", () => {
    expect(out).not.toContain("Torch");
  });

  it("should not show the typing form until it is asked for", () => {
    expect(out).not.toContain("Seat code");
  });
});

describe("Seat scan: the seat matches", () => {
  it("should show the banner, the verified seat with its last checks and the button to go on", () => {
    const out = renderResult(scan());

    expect(out).toContain("Seat matches this booking");
    expect(out).toContain("Scanned SEAT-0001 · Assigned SEAT-0001 · Convertible · DXB");
    expect(out).toContain("Verified seat");
    expect(out).toContain("24 Oct · 13:20 GST · Pass");
    expect(out).toContain("24 Oct · 13:45 GST · Pass");
    expect(out).toContain("Continue to checklist");
    expect(out).toContain('href="/jobs/j-1/installation"');
  });

  it("should write a dash, not a pass, for a check that was never made", () => {
    const out = renderResult(scan({ checks: { last_cleaning: null, last_inspection: null } }));

    expect(out).not.toContain("Pass");
    expect(out.match(/>—</g)?.length).toBe(2);
  });
});

describe("Seat scan: the seat is not the assigned one", () => {
  const mismatch = scan({
    match: false,
    scanned: { serial_number: "SEAT-0005", category_name: "Convertible", status: "reserved" },
    checks: null,
  });

  it("should show the banner, the expected and the scanned seat, and the way to scan again", () => {
    const out = renderResult(mismatch);

    expect(out).toContain("This is not the assigned seat");
    expect(out).toContain("Scanned SEAT-0005. This booking requires SEAT-0001. Do not install this seat.");
    expect(out).toContain("SEAT-0001 · Convertible");
    expect(out).toContain("SEAT-0005 · Convertible");
    expect(out).toContain("Scan again");
    expect(out).toContain("Report mismatch");
    expect(out).toContain('href="/incidents/new?job_id=j-1"');
    expect(out).not.toContain("Continue to checklist");
  });

  it("should say the seat is reserved for another booking only when its status says so", () => {
    expect(renderResult(mismatch)).toContain("Reserved for another booking");
    expect(renderResult(scan({ ...mismatch, scanned: { ...mismatch.scanned, status: "available" } }))).not.toContain(
      "Reserved for another booking",
    );
  });

  it("should write a dash for a seat the technician cannot read, and make nothing up", () => {
    const out = renderResult(scan({ ...mismatch, scanned: { serial_number: null, category_name: null, status: null } }));

    expect(out).toContain("Scanned —.");
    expect(out).not.toContain("Reserved for another booking");
  });

  it("should hide Report mismatch from a user who may not report an incident", () => {
    expect(renderResult(mismatch, null)).not.toContain("Report mismatch");
  });
});
