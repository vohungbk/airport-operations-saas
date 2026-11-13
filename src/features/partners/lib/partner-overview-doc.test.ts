import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { buildPartnerOverview } from "@/features/partners/lib/partner-overview";

const DOC = join(process.cwd(), "docs", "kpi-formulas.md");
const HEADING = "## Partner overview figures (VI-F11-S12)";

/** The figure names of the table under the heading of the Partner overview in docs/kpi-formulas.md. */
function readFigureNames(): string[] {
  const lines = readFileSync(DOC, "utf8").split("\n");
  const start = lines.findIndex((line) => line.trim() === HEADING);
  if (start === -1) throw new Error("Partner overview section not found in docs/kpi-formulas.md");

  const rows = lines.slice(start).filter((line) => line.startsWith("|"));

  return rows.slice(2).map((line) => line.split("|")[1].trim());
}

describe("documented partner overview figures (VI-F11-S12, spec R12)", () => {
  it("should document every tile, revenue row and the launch credit the screen shows, in the same order", () => {
    const view = buildPartnerOverview(
      {
        rentals_today: null,
        rentals_yesterday: null,
        active_rentals: null,
        upcoming_reservations: null,
        family_ready: null,
        awaiting_installation: null,
        resolved_incidents: null,
        core: null,
        finance: null,
      },
      new Date("2026-10-24T09:00:00.000Z"),
    );

    expect(readFigureNames()).toEqual([
      ...view.tiles.map((tile) => tile.label),
      ...view.revenue.map((row) => row.label),
      "Launch credit",
    ]);
  });
});
