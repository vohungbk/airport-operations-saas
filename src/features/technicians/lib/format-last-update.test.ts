import { describe, expect, it } from "vitest";

import { formatLastUpdate } from "@/features/technicians/lib/format-last-update";

describe("formatLastUpdate", () => {
  it("should write the date, the time and the short zone name of Asia/Dubai", () => {
    expect(formatLastUpdate("2026-10-24T10:30:00Z", "Asia/Dubai")).toBe(
      "24 Oct 2026, 14:30 GST",
    );
  });

  it("should move to the next day when the airport zone is past midnight", () => {
    expect(formatLastUpdate("2026-10-24T21:00:00Z", "Asia/Dubai")).toBe(
      "25 Oct 2026, 01:00 GST",
    );
  });

  it("should use the UTC label for a UTC zone", () => {
    expect(formatLastUpdate("2026-10-24T10:30:00Z", "UTC")).toBe(
      "24 Oct 2026, 10:30 UTC",
    );
  });
});
