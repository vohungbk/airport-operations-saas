import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hookMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/cleaning/hooks/use-complete-cleaning-form", () => ({
  useCompleteCleaningForm: hookMock,
}));

import { CleaningCompleteForm } from "@/features/cleaning/components/cleaning-complete-form";

function hookState(result: unknown, errors: Record<string, unknown> = {}) {
  return {
    form: { register: () => ({}), formState: { errors } },
    onSubmit: vi.fn(),
    isPending: false,
    result,
    viewCleaning: vi.fn(),
  };
}

function render() {
  return renderToStaticMarkup(
    createElement(CleaningCompleteForm, {
      jobId: "j-1",
      seatLabel: "SN-1",
      startedLabel: "17 Oct 2026, 19:30 by Ahmed",
    }),
  );
}

describe("CleaningCompleteForm", () => {
  beforeEach(() => {
    hookMock.mockReset();
  });

  it("should show the seat, the start, both results and no default choice", () => {
    hookMock.mockReturnValue(hookState(null));

    const html = render();

    expect(html).toContain("SN-1");
    expect(html).toContain("17 Oct 2026, 19:30 by Ahmed");
    expect(html).toContain("Passed");
    expect(html).toContain("Failed");
    // Neither radio is pre-selected: the technician has to choose.
    expect(html.match(/<input[^>]*type="radio"[^>]*>/g)).toHaveLength(2);
    expect(html).not.toMatch(/<input[^>]*type="radio"[^>]*checked/);
    expect(html).toContain("Complete cleaning");
  });

  it("should show a clear message when the result is not chosen", () => {
    hookMock.mockReturnValue(
      hookState(null, { result: { message: "Choose the result." } }),
    );

    expect(render()).toContain("Choose the result.");
  });

  it("should say the result was not saved and offer the cleaning after a conflict, keeping the form", () => {
    hookMock.mockReturnValue(
      hookState({
        success: false,
        error: { code: "ALREADY_RECORDED", message: "raw" },
      }),
    );

    const html = render();

    expect(html).toContain("Someone completed this cleaning first.");
    expect(html).toContain("Your result was not saved.");
    expect(html).toContain("View the cleaning");
    expect(html).toContain("Cleaning notes");
  });

  it("should tell the user the cleaning has not been started and keep the form", () => {
    hookMock.mockReturnValue(
      hookState({
        success: false,
        error: {
          code: "NOT_STARTED",
          message: "The cleaning has not been started yet.",
        },
      }),
    );

    const html = render();

    expect(html).toContain("Could not complete the cleaning");
    expect(html).toContain("The cleaning has not been started yet.");
    expect(html).toContain("Cleaning notes");
    expect(html).not.toContain('href="/jobs"');
  });

  it("should keep the entry and tell the user to retry after a network failure", () => {
    hookMock.mockReturnValue(
      hookState({
        success: false,
        error: {
          code: "NETWORK_ERROR",
          message: "Could not reach the server. Your input is kept; check your connection and try again.",
        },
      }),
    );

    const html = render();

    expect(html).toContain("Could not complete the cleaning");
    expect(html).toContain("Your input is kept");
    expect(html).toContain("Cleaning notes");
    expect(html).not.toContain('href="/jobs"');
  });

  it("should point back to the jobs when access is lost", () => {
    hookMock.mockReturnValue(
      hookState({
        success: false,
        error: { code: "FORBIDDEN", message: "You do not have permission to do this." },
      }),
    );

    const html = render();

    expect(html).toContain("You no longer have access to this action");
    expect(html).toContain('href="/jobs"');
  });

  it("should keep the form usable after a recoverable error such as a seat changed meanwhile", () => {
    hookMock.mockReturnValue(
      hookState({
        success: false,
        error: {
          code: "SEAT_NOT_ELIGIBLE",
          message: "The seat is no longer being cleaned. Reload the page.",
        },
      }),
    );

    const html = render();

    expect(html).toContain("Could not complete the cleaning");
    expect(html).toContain("Reload the page");
    expect(html).toContain("Complete cleaning");
  });

  it("should name the group of results with a legend, so a screen reader reads the question with each choice", () => {
    hookMock.mockReturnValue(hookState(null));

    const html = render();

    expect(html).toMatch(/<fieldset[^>]*>\s*<legend[^>]*>Result<\/legend>/);
    expect(html).not.toMatch(/<label[^>]*>Result<\/label>/);
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
