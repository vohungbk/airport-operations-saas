import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { InspectionRecord } from "@/features/inspections/components/inspection-record";
import type { InspectionRecord as InspectionRecordItem } from "@/features/inspections/lib/get-inspection-context";

function render(overrides: Partial<InspectionRecordItem> = {}) {
  const record: InspectionRecordItem = {
    id: "i-1",
    result: "fail",
    notes: "Strap worn",
    created_at: "2026-10-16T08:05:00Z",
    follow_up: null,
    seat_serial_number: "SN-2",
    recorded_by: "Ahmed",
    ...overrides,
  };

  return renderToStaticMarkup(
    createElement(InspectionRecord, { record, timeZone: "Asia/Dubai" }),
  );
}

describe("InspectionRecord", () => {
  it("should show no follow-up alert when nothing happened to the seat", () => {
    const html = render({ result: "pass" });

    expect(html).not.toContain("Follow-up");
    expect(html).toContain("Strap worn");
  });

  it("should say the seat was quarantined after a failed inspection", () => {
    const html = render({ follow_up: "seat_quarantined" });

    expect(html).toContain("Follow-up");
    expect(html).toContain("The seat was moved to quarantine.");
    expect(html).not.toContain("active booking");
  });

  it("should warn about the active booking when the seat is in one", () => {
    const html = render({ follow_up: "seat_quarantined_active_booking" });

    expect(html).toContain("The seat was moved to quarantine.");
    expect(html).toContain("This seat is in an active booking. Review the booking.");
  });
});
