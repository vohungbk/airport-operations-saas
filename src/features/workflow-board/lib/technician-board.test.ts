import { describe, expect, it } from "vitest";

import {
  TECHNICIAN_ACTIVE_STEPS,
  buildTechnicianBoardHref,
  isTechnicianActiveStep,
  resolveSelectedStep,
} from "@/features/workflow-board/lib/technician-board";
import { BOOKING_BOARD_STEPS } from "@/lib/workflow/board";

const columns = (totals: Record<string, number>) =>
  BOOKING_BOARD_STEPS.map((status) => ({ status, total: totals[status] ?? 0 }));

describe("isTechnicianActiveStep (CO-F08-T02 AC03)", () => {
  it.each(["assigned", "en_route", "installed", "family_ready"] as const)("should make %s an active step", (step) => {
    expect(isTechnicianActiveStep(step)).toBe(true);
  });

  it("should leave every other step of the path read-only", () => {
    const readOnly = BOOKING_BOARD_STEPS.filter((step) => !isTechnicianActiveStep(step));

    expect(readOnly).toHaveLength(BOOKING_BOARD_STEPS.length - TECHNICIAN_ACTIVE_STEPS.length);
    expect(readOnly).toContain("in_progress");
    expect(readOnly).toContain("pending");
  });
});

describe("resolveSelectedStep", () => {
  it("should open the step in the address when it is an active step", () => {
    expect(resolveSelectedStep("installed", columns({ en_route: 3 }))).toBe("installed");
  });

  it("should open the first active step with a booking when the address has no step", () => {
    expect(resolveSelectedStep(undefined, columns({ installed: 2, family_ready: 1 }))).toBe("installed");
  });

  it("should open the first active step when there is no booking at all", () => {
    expect(resolveSelectedStep(undefined, columns({}))).toBe("assigned");
  });

  it.each(["in_progress", "garbage", ""])("should ignore a step in the address that is not active: %s", (raw) => {
    expect(resolveSelectedStep(raw, columns({ en_route: 3 }))).toBe("en_route");
  });

  it("should use the first value when the address repeats the step", () => {
    expect(resolveSelectedStep(["family_ready", "installed"], columns({}))).toBe("family_ready");
  });
});

describe("buildTechnicianBoardHref", () => {
  it("should stay on the technician board, not the admin one", () => {
    expect(buildTechnicianBoardHref({})).toBe("/technician/workflow");
  });

  it("should keep the filters and add the step", () => {
    expect(buildTechnicianBoardHref({ q: "BK-1" }, "en_route")).toBe("/technician/workflow?q=BK-1&step=en_route");
    expect(buildTechnicianBoardHref({}, "installed")).toBe("/technician/workflow?step=installed");
  });

  it("should never carry the booking of a preview, which a technician does not have", () => {
    expect(buildTechnicianBoardHref({ booking: "c0000000-0000-0000-0000-000000000001" })).toBe("/technician/workflow");
  });
});
