import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import PartnerRoiError from "@/app/(partner)/partner/roi/error";
import PartnerRoiLoading from "@/app/(partner)/partner/roi/loading";

describe("the loading and error states of the partner ROI dashboard (VI-F05-S04, AC01)", () => {
  it("should render the shared loading state", () => {
    expect(renderToStaticMarkup(createElement(PartnerRoiLoading))).toContain('aria-busy="true"');
  });

  it("should say the ROI dashboard could not be loaded, offer a retry, and never show the raw error", () => {
    const html = renderToStaticMarkup(
      createElement(PartnerRoiError, { error: new Error("connection to db.internal:5432 refused"), reset: vi.fn() }),
    );

    expect(html).toContain("Could not load the ROI dashboard");
    expect(html).toContain("Try again");
    expect(html).not.toContain("db.internal");
  });
});
