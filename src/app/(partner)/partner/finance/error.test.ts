import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import PartnerFinanceError from "@/app/(partner)/partner/finance/error";

describe("PartnerFinanceError", () => {
  it("should say the finance could not be loaded and offer a retry", () => {
    const html = renderToStaticMarkup(
      createElement(PartnerFinanceError, { error: new Error("x"), reset: vi.fn() }),
    );

    expect(html).toContain("Could not load finance");
    expect(html).toContain("Try again");
  });

  it("should never show the raw error message", () => {
    const html = renderToStaticMarkup(
      createElement(PartnerFinanceError, {
        error: new Error("connection to db.internal:5432 refused"),
        reset: vi.fn(),
      }),
    );

    expect(html).not.toContain("db.internal");
  });
});
