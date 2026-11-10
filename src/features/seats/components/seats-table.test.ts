import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SeatsTable } from "@/features/seats/components/seats-table";

const seat = (overrides: Record<string, unknown> = {}) => ({
  id: "s-1",
  public_token: "d65193a1-bd16-5a78-fd25-e4a1428026e6",
  serial_number: "CS-2024-0001",
  status: "available",
  created_at: "2026-08-01T00:00:00Z",
  category: { id: "c", name: "Infant (0-12 months)" },
  airport: { id: "a", code: "HAN", name: "Noi Bai" },
  ...overrides,
});

const draw = (seats: unknown[]) =>
  renderToStaticMarkup(createElement(SeatsTable, { seats } as never));

describe("the seats table", () => {
  it("should show the airport as name and code, and the category", () => {
    const out = draw([seat()]);

    expect(out).toContain("Noi Bai (HAN)");
    expect(out).toContain("Infant (0-12 months)");
  });

  it("should link the serial number to the seat detail", () => {
    expect(draw([seat()])).toContain('href="/seats/s-1"');
  });

  it("should show a dash when the airport and category are missing", () => {
    const out = draw([seat({ airport: null, category: null })]);

    expect(out.match(/—/g)).toHaveLength(2);
  });

  it("should not show the removed columns", () => {
    const out = draw([seat()]);

    expect(out).not.toContain("Public token");
    expect(out).not.toContain("Actions");
  });
});
