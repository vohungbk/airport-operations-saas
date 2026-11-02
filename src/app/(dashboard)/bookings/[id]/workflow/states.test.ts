import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import BookingWorkflowError from "@/app/(dashboard)/bookings/[id]/workflow/error";
import BookingWorkflowForbidden from "@/app/(dashboard)/bookings/[id]/workflow/forbidden";
import BookingWorkflowLoading from "@/app/(dashboard)/bookings/[id]/workflow/loading";
import BookingWorkflowNotFound from "@/app/(dashboard)/bookings/[id]/workflow/not-found";

const CAUSE = "LEAK-relation bookings does not exist at 10.0.0.5";

/** CO-F08-S06 AC01: the loading, error, not found and permission denied states of the screen. */
describe("the states of the booking workflow screen", () => {
  it("should announce loading as busy, with a name", () => {
    const html = renderToStaticMarkup(createElement(BookingWorkflowLoading));

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('aria-label="Loading"');
  });

  it("should offer a retry on error and never show the error that caused it", () => {
    const failure = Object.assign(new Error(CAUSE), { digest: "digest-1" });
    const html = renderToStaticMarkup(createElement(BookingWorkflowError, { error: failure, reset: () => {} }));

    expect(html).toContain("The booking workflow could not be loaded.");
    expect(html).toContain("Try again");
    expect(html).not.toContain("LEAK");
    expect(html).not.toContain("10.0.0.5");
    expect(html).not.toContain("digest-1");
  });

  it("should say the booking was not found and lead back to the bookings", () => {
    const html = renderToStaticMarkup(createElement(BookingWorkflowNotFound));

    expect(html).toContain("Booking not found.");
    expect(html).toContain('href="/bookings"');
  });

  it("should say the user may not view the booking and lead back to the bookings", () => {
    const html = renderToStaticMarkup(createElement(BookingWorkflowForbidden));

    expect(html).toContain("You do not have permission to view this booking.");
    expect(html).toContain('href="/bookings"');
  });
});
