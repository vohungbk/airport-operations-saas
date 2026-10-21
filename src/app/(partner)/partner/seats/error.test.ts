import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import PartnerSeatsError from "@/app/(partner)/partner/seats/error";

describe("PartnerSeatsError", () => {
  it("should say the seats could not be loaded and offer a retry", () => {
    const html = renderToStaticMarkup(
      createElement(PartnerSeatsError, { error: new Error("x"), reset: vi.fn() }),
    );

    expect(html).toContain("Could not load seats");
    expect(html).toContain("Try again");
  });

  it("should never show the raw error message", () => {
    const html = renderToStaticMarkup(
      createElement(PartnerSeatsError, {
        error: new Error("connection to db.internal:5432 refused"),
        reset: vi.fn(),
      }),
    );

    expect(html).not.toContain("db.internal");
  });
});
