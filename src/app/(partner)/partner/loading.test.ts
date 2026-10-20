import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import PartnerLoading from "@/app/(partner)/partner/loading";

describe("PartnerLoading", () => {
  it("should render the shared loading state", () => {
    expect(renderToStaticMarkup(createElement(PartnerLoading))).toContain(
      'aria-busy="true"',
    );
  });
});
