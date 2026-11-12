import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { IncidentHistoryTimeline } from "@/features/incidents/components/incident-history-timeline";
import type { IncidentHistoryItem } from "@/features/incidents/types";

function entry(overrides: Partial<IncidentHistoryItem> = {}): IncidentHistoryItem {
  return {
    id: "h-1",
    from_status: "open",
    to_status: "investigating",
    notes: null,
    created_at: "2026-10-17T09:00:00Z",
    actor_name: "Fatima",
    ...overrides,
  };
}

function render(history: IncidentHistoryItem[], truncated = false) {
  return renderToStaticMarkup(
    createElement(IncidentHistoryTimeline, {
      history,
      truncated,
      timeZone: "Asia/Dubai",
    }),
  );
}

describe("IncidentHistoryTimeline", () => {
  it("should say nothing was recorded when the history is empty", () => {
    expect(render([])).toContain("No changes recorded.");
  });

  it("should show who changed the status, from what to what, as text", () => {
    const html = render([entry()]);

    expect(html).toContain("Fatima");
    expect(html).toContain("Open");
    expect(html).toContain("Investigating");
  });

  it("should show the note when there is one and leave it out when there is none", () => {
    expect(render([entry({ notes: "Seat failed again" })])).toContain(
      "Seat failed again",
    );
    expect(render([entry()]).match(/<p/g)).toHaveLength(3);
  });

  it("should show the first entry as Created to the first status", () => {
    const html = render([entry({ from_status: null, to_status: "open" })]);

    expect(html).toContain("Created");
    expect(html).toContain("Open");
  });

  it("should show the time of the change in the airport time zone", () => {
    expect(render([entry()])).toContain("17 Oct 2026 13:00 GST");
  });

  it("should fall back to Staff when the actor is unknown", () => {
    expect(render([entry({ actor_name: null })])).toContain("Staff");
  });

  it("should render a note as text and not as markup", () => {
    const html = render([entry({ notes: "<script>alert(1)</script>" })]);

    expect(html).not.toContain("<script>");
  });

  it("should say the list was cut when it is truncated", () => {
    expect(render([entry()], true)).toContain("Showing latest 50 changes");
    expect(render([entry()], false)).not.toContain("Showing latest");
  });
});
