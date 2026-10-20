import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import PartnerError from "@/app/(partner)/partner/error";

describe("PartnerError", () => {
  it("should say the partner home could not be loaded and offer a retry", () => {
    const html = renderToStaticMarkup(
      createElement(PartnerError, { error: new Error("x"), reset: vi.fn() }),
    );

    expect(html).toContain("Could not load the partner home");
    expect(html).toContain("Try again");
  });

  it("should never show the raw error message", () => {
    const html = renderToStaticMarkup(
      createElement(PartnerError, {
        error: new Error("connection to db.internal:5432 refused"),
        reset: vi.fn(),
      }),
    );

    expect(html).not.toContain("db.internal");
  });
});
