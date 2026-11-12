import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ChainHistory } from "@/features/return-queue/components/chain-history";
import { toChainHistoryEntries, type ChainHistoryRow } from "@/features/return-queue/lib/chain-history";

const row = (over: Partial<ChainHistoryRow> = {}): ChainHistoryRow => ({
  id: "s-1",
  step: "cleaning",
  result: "pass",
  notes: null,
  photo_paths: ["a.jpg", "b.jpg"],
  completed_at: "2026-10-24T09:00:00Z",
  completed_by_user: { full_name: "An Nguyen" },
  booking: { booking_number: "BK-100" },
  ...over,
});

const render = (rows: ChainHistoryRow[], showBooking = false, truncated = false) =>
  renderToStaticMarkup(createElement(ChainHistory, { rows, formatTime: (iso: string) => iso, showBooking, truncated }));

describe("toChainHistoryEntries (FO-F08-S10, R9)", () => {
  it("should name the step, the actor, the result and the photo count", () => {
    expect(toChainHistoryEntries([row()], false)[0]).toMatchObject({
      step_label: "Cleaning",
      actor: "An Nguyen",
      result: "pass",
      photos_label: "2 photos",
      booking_number: null,
    });
  });

  it("should keep the order it is given, newest first", () => {
    const entries = toChainHistoryEntries([row({ id: "new" }), row({ id: "old" })], false);
    expect(entries.map((e) => e.id)).toEqual(["new", "old"]);
  });

  it.each([
    [1, "1 photo"],
    [3, "3 photos"],
  ])("should say %s photo(s) as %s", (count, label) => {
    const entry = toChainHistoryEntries([row({ photo_paths: Array(count).fill("p.jpg") })], false)[0];
    expect(entry.photos_label).toBe(label);
  });
});

describe("ChainHistory", () => {
  it("should show a failed step with its note and who completed it", () => {
    const out = render([row({ result: "fail", notes: "Cracked shell" })]);
    expect(out).toContain("Chain history");
    expect(out).toContain('data-status="fail"');
    expect(out).toContain("Cracked shell");
    expect(out).toContain("An Nguyen");
  });

  it("should name the booking of each step on the seat page only", () => {
    expect(render([row()], true)).toContain("BK-100");
    expect(render([row()], false)).not.toContain("BK-100");
  });

  it("should say so when no step is recorded, and offer no edit control", () => {
    const out = render([]);
    expect(out).toContain("No chain steps recorded.");
    expect(out).not.toContain("<button");
  });

  it("should say when older steps were cut off", () => {
    expect(render([row()], false, true)).toContain("Showing latest 100 steps");
  });
});
