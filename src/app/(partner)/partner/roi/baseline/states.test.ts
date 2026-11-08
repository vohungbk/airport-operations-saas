import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import PartnerBaselineInputsError from "@/app/(partner)/partner/roi/baseline/error";
import PartnerBaselineInputsLoading from "@/app/(partner)/partner/roi/baseline/loading";

describe("the loading and error states of the Baseline inputs screen (VI-F05-S05, AC02)", () => {
  it("should render the shared loading state", () => {
    expect(renderToStaticMarkup(createElement(PartnerBaselineInputsLoading))).toContain('aria-busy="true"');
  });

  it("should say the baseline inputs could not be loaded, offer a retry, and never show the raw error", () => {
    const html = renderToStaticMarkup(
      createElement(PartnerBaselineInputsError, { error: new Error("connection to db.internal:5432 refused"), reset: vi.fn() }),
    );

    expect(html).toContain("Could not load the baseline inputs");
    expect(html).toContain("Try again");
    expect(html).not.toContain("db.internal");
  });
});
