import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hookMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/inspections/hooks/use-record-inspection-form", () => ({
  useRecordInspectionForm: hookMock,
}));

import { InspectionForm } from "@/features/inspections/components/inspection-form";

function hookState(result: unknown, errors: Record<string, unknown> = {}) {
  return {
    form: { register: () => ({}), formState: { errors } },
    onSubmit: vi.fn(),
    isPending: false,
    result,
    viewRecordedInspection: vi.fn(),
  };
}

function render() {
  return renderToStaticMarkup(
    createElement(InspectionForm, {
      jobId: "j-1",
      seatId: "s-1",
      seatLabel: "SN-1",
    }),
  );
}

describe("InspectionForm", () => {
  beforeEach(() => {
    hookMock.mockReset();
  });

  it("should show the seat, three results with none chosen, notes and Cancel", () => {
    hookMock.mockReturnValue(hookState(null));

    const html = render();

    expect(html).toContain("SN-1");
    expect(html.match(/<input[^>]*type="radio"[^>]*>/g)).toHaveLength(3);
    expect(html).not.toMatch(/<input[^>]*type="radio"[^>]*checked/);
    expect(html).toContain("Inspection notes");
    expect(html).toContain('href="/jobs/j-1"');
    expect(html).not.toContain("Could not record inspection");
  });

  it("should show a clear message when the result is not chosen", () => {
    hookMock.mockReturnValue(
      hookState(null, { result: { message: "Choose the result." } }),
    );

    expect(render()).toContain("Choose the result.");
  });

  it("should say the entry was not saved and offer the recorded inspection after a conflict, keeping the form", () => {
    hookMock.mockReturnValue(
      hookState({
        success: false,
        error: { code: "ALREADY_RECORDED", message: "raw" },
      }),
    );

    const html = render();

    expect(html).toContain("Already recorded");
    expect(html).toContain("Your entry was not saved");
    expect(html).toContain("View the recorded inspection");
    expect(html).toContain("Inspection notes");
  });

  it("should keep the entry and tell the user to retry after a network failure", () => {
    hookMock.mockReturnValue(
      hookState({
        success: false,
        error: {
          code: "NETWORK_ERROR",
          message:
            "Could not reach the server. Your input is kept; check your connection and try again.",
        },
      }),
    );

    const html = render();

    expect(html).toContain("Could not record inspection");
    expect(html).toContain("Your input is kept");
    expect(html).toContain("Inspection notes");
    expect(html).not.toContain('href="/jobs"');
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

  it("should say access was lost when the database denies the insert", () => {
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

  it("should keep the form usable after a recoverable error", () => {
    hookMock.mockReturnValue(
      hookState({
        success: false,
        error: {
          code: "SEAT_NOT_ELIGIBLE",
          message: "The seat is retired, so an inspection cannot be recorded.",
        },
      }),
    );

    const html = render();

    expect(html).toContain("Could not record inspection");
    expect(html).not.toContain('href="/jobs"');
    expect(html).toContain("Inspection notes");
  });

  it("should name the group of results with a legend, so a screen reader reads the question with each choice", () => {
    hookMock.mockReturnValue(hookState(null));

    const html = render();

    expect(html).toMatch(/<fieldset[^>]*>\s*<legend[^>]*>Inspection result<\/legend>/);
    expect(html).not.toMatch(/<label[^>]*>Inspection result<\/label>/);
  });

  it("should tie the error of the results to the group when no result is chosen", () => {
    hookMock.mockReturnValue(
      hookState(null, { result: { message: "Choose the result." } }),
    );

    const html = render();

    expect(html).toMatch(/<fieldset[^>]*aria-describedby="result-error"/);
    expect(html).toContain('id="result-error"');
  });
});
