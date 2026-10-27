import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SeatStatusHistory } from "@/features/seats/components/seat-status-history";
import type { SeatHistoryItem } from "@/features/seats/lib/get-seat-status-history";

const entry = (over: Partial<SeatHistoryItem> = {}): SeatHistoryItem => ({
  id: "h-1",
  from_status: "available",
  to_status: "quarantine",
  reason: "Cracked shell",
  created_at: "2026-10-26T09:00:00Z",
  changed_by_user: { full_name: "An Nguyen" },
  ...over,
});

const render = (history: SeatHistoryItem[], truncated = false) =>
  renderToStaticMarkup(createElement(SeatStatusHistory, { history, truncated }));

describe("SeatStatusHistory (UI-F06-S02, R3)", () => {
  it("should show the changes as the shared timeline", () => {
    expect(render([entry()])).toContain('data-slot="timeline"');
  });

  it("should show the old status, the new one, who made the change and why", () => {
    const out = render([entry()]);
    expect(out).toContain('data-status="available"');
    expect(out).toContain('data-status="quarantine"');
    expect(out).toContain("An Nguyen");
    expect(out).toContain("Cracked shell");
  });

  it("should say Created for the first entry, which has no old status", () => {
    expect(render([entry({ from_status: null, to_status: "available", reason: null })])).toContain("Created");
  });

  it("should keep the order it is given, newest first", () => {
    const out = render([entry({ id: "h-2", reason: "Second change" }), entry({ id: "h-1", reason: "First change" })]);
    expect(out.indexOf("Second change")).toBeLessThan(out.indexOf("First change"));
  });

  it("should write Unknown when nobody is recorded as the actor", () => {
    expect(render([entry({ changed_by_user: null })])).toContain("Unknown");
  });

  it("should say there are no changes, not draw an empty timeline", () => {
    const out = render([]);
    expect(out).toContain("No status changes recorded.");
    expect(out).not.toContain('data-slot="timeline"');
  });

  it("should say the list is cut when there are more changes than it shows", () => {
    expect(render([entry()], true)).toContain("Showing latest 100 changes");
    expect(render([entry()], false)).not.toContain("Showing latest");
  });

  it("should keep the heading of the section", () => {
    expect(render([entry()])).toContain("Status history");
  });
});
