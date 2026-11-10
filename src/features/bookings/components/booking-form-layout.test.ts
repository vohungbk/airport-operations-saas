import { describe, expect, it } from "vitest";

import { collectFieldMessages } from "@/features/bookings/components/booking-form-layout";

describe("collectFieldMessages", () => {
  it("should list the messages of the failing fields in the order of the form", () => {
    const messages = collectFieldMessages({
      daily_rate: { type: "custom", message: "Daily price must be greater than 0." },
      partner_id: { type: "custom", message: "Partner is required." },
    });

    expect(messages).toEqual([
      "Partner is required.",
      "Daily price must be greater than 0.",
    ]);
  });

  it("should list nothing when the form has no errors", () => {
    expect(collectFieldMessages({})).toEqual([]);
  });

  it("should skip an error without a text message", () => {
    expect(collectFieldMessages({ notes: { type: "custom" } })).toEqual([]);
  });
});
