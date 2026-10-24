import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import CommercialTermsNotFound from "@/app/(admin)/partners/[id]/terms/not-found";

describe("CommercialTermsNotFound", () => {
  it("should say the partner does not exist and link back to the partners", () => {
    const html = renderToStaticMarkup(createElement(CommercialTermsNotFound));

    expect(html).toContain("Partner not found");
    expect(html).toContain('href="/partners"');
  });
});
