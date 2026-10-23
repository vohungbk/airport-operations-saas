import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hookMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/cleaning/hooks/use-start-cleaning", () => ({
  useStartCleaning: hookMock,
}));

import { CleaningStartPanel } from "@/features/cleaning/components/cleaning-start-panel";

function hookState(result: unknown, isPending = false) {
  return { start: vi.fn(), isPending, result, viewCleaning: vi.fn() };
}

function render() {
  return renderToStaticMarkup(
    createElement(CleaningStartPanel, { jobId: "j-1", seatLabel: "SN-1" }),
  );
}

describe("CleaningStartPanel", () => {
  beforeEach(() => {
    hookMock.mockReset();
  });

  it("should offer Start and Cancel with no error before the first press", () => {
    hookMock.mockReturnValue(hookState(null));

    const html = render();

    expect(html).toContain("Start cleaning");
    expect(html).toContain('href="/jobs/j-1"');
    expect(html).not.toContain("Could not start the cleaning");
  });

  it("should tell the user to handle the other booking when one holds or uses the seat", () => {
    hookMock.mockReturnValue(
      hookState({
        success: false,
        error: {
          code: "SEAT_IN_USE",
          message:
            "Another booking holds or uses the seat now or soon. Handle that booking first, then start the cleaning.",
        },
      }),
    );

    const html = render();

    expect(html).toContain("Could not start the cleaning");
    expect(html).toContain("Handle that booking first");
    expect(html).toContain("Start cleaning");
  });

  it("should offer the cleaning that was kept when someone started it first", () => {
    hookMock.mockReturnValue(
      hookState({
        success: false,
        error: { code: "ALREADY_RECORDED", message: "raw" },
      }),
    );

    const html = render();

    expect(html).toContain("Someone started this cleaning first.");
    expect(html).toContain("View the cleaning");
  });

  it("should point back to the jobs when the technician is not assigned any more", () => {
    hookMock.mockReturnValue(
      hookState({
        success: false,
        error: { code: "NOT_FOUND", message: "This job was not found." },
      }),
    );

    const html = render();

    expect(html).toContain("This job is no longer available");
    expect(html).toContain('href="/jobs"');
  });

  it("should say access was lost and point back to the jobs when the database denies the start", () => {
    hookMock.mockReturnValue(
      hookState({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "You do not have permission to do this.",
        },
      }),
    );

    const html = render();

    expect(html).toContain("You no longer have access to this action");
    expect(html).toContain('href="/jobs"');
  });

  it("should keep the button usable after a network failure", () => {
    hookMock.mockReturnValue(
      hookState({
        success: false,
        error: { code: "NETWORK_ERROR", message: "Your input is kept; try again." },
      }),
    );

    const html = render();

    expect(html).toContain("Could not start the cleaning");
    expect(html).not.toContain('href="/jobs"');
  });
});
