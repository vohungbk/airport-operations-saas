import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import PartnerKpiError from "@/app/(partner)/partner/kpi/error";
import PartnerKpiLoading from "@/app/(partner)/partner/kpi/loading";

describe("the loading and error states of the partner KPI dashboard (VI-F05-S01, AC02)", () => {
  it("should render the shared loading state", () => {
    expect(renderToStaticMarkup(createElement(PartnerKpiLoading))).toContain('aria-busy="true"');
  });

  it("should say the KPIs could not be loaded, offer a retry, and never show the raw error", () => {
    const html = renderToStaticMarkup(
      createElement(PartnerKpiError, { error: new Error("connection to db.internal:5432 refused"), reset: vi.fn() }),
    );

    expect(html).toContain("Could not load the KPIs");
    expect(html).toContain("Try again");
    expect(html).not.toContain("db.internal");
  });
});
