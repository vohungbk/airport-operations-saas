import { describe, expect, it } from "vitest";

import { getCardMoveNote } from "@/features/workflow-board/lib/card-move-note";

describe("getCardMoveNote (CO-F08-T01)", () => {
  it("should say the seat must be Available when the booking moves to Technician Assigned and the seat is not", () => {
    expect(getCardMoveNote("assigned", "in_use")).toBe("Seat must be Available");
    expect(getCardMoveNote("assigned", "cleaning")).toBe("Seat must be Available");
  });

  it("should say the seat must be Reserved before Active Rental", () => {
    expect(getCardMoveNote("in_progress", "available")).toBe("Seat must be Reserved");
  });

  it("should say nothing when the seat is in the status the step needs", () => {
    expect(getCardMoveNote("assigned", "available")).toBeNull();
    expect(getCardMoveNote("in_progress", "reserved")).toBeNull();
  });

  it("should say a seat has to be assigned when the step needs a seat and the booking has none", () => {
    expect(getCardMoveNote("assigned", null)).toBe("Assign a seat to this booking first.");
  });

  it("should say nothing for a step that has no seat rule, with or without a seat", () => {
    expect(getCardMoveNote("confirmed", null)).toBeNull();
    expect(getCardMoveNote("confirmed", "in_use")).toBeNull();
  });
});
