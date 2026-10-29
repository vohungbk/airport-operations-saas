import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import PartnerFinanceLoading from "@/app/(partner)/partner/finance/loading";

describe("PartnerFinanceLoading", () => {
  it("should render the shared loading state", () => {
    expect(renderToStaticMarkup(createElement(PartnerFinanceLoading))).toContain(
      'aria-busy="true"',
    );
  });
});
