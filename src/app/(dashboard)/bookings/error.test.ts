import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import BookingsError from "@/app/(dashboard)/bookings/error";

describe("BookingsError", () => {
  it("should say the bookings could not be loaded and offer a retry", () => {
    const html = renderToStaticMarkup(
      createElement(BookingsError, { error: new Error("x"), reset: vi.fn() }),
    );

    expect(html).toContain("Could not load bookings");
    expect(html).toContain("Try again");
  });

  it("should never show the raw error message", () => {
    const html = renderToStaticMarkup(
      createElement(BookingsError, {
        error: new Error("connection to db.internal:5432 refused"),
        reset: vi.fn(),
      }),
    );

    expect(html).not.toContain("db.internal");
  });
});
