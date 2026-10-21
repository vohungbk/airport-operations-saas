import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import PartnerSeatsLoading from "@/app/(partner)/partner/seats/loading";

describe("PartnerSeatsLoading", () => {
  it("should render the shared loading state", () => {
    expect(renderToStaticMarkup(createElement(PartnerSeatsLoading))).toContain(
      'aria-busy="true"',
    );
  });
});
