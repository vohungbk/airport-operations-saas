import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/settlements/actions/move-settlement-status.action", () => ({
  moveSettlementStatusAction: vi.fn(),
}));

import { MoveSettlementButtons } from "@/features/settlements/components/move-settlement-buttons";
import type { SettlementStatus } from "@/features/settlements/lib/settlement";

const render = (status: SettlementStatus) =>
  renderToStaticMarkup(createElement(MoveSettlementButtons, { settlementId: "s-1", status }));

describe("MoveSettlementButtons", () => {
  it("should offer to send a draft for approval", () => {
    expect(render("draft")).toContain(">Send for approval<");
  });

  it("should offer to approve or send back a settlement that waits for approval", () => {
    const html = render("pending_approval");

    expect(html).toContain(">Approve<");
    expect(html).toContain(">Send back to draft<");
  });

  it("should offer to mark an approved settlement as paid, and nothing to go back", () => {
    const html = render("approved");

    expect(html).toContain(">Mark as paid<");
    expect(html).not.toContain("Send back");
  });

  it("should offer no button for a paid settlement", () => {
    expect(render("paid")).not.toContain("<button");
  });
});
