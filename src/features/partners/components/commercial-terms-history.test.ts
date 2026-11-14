import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CommercialTermsHistory } from "@/features/partners/components/commercial-terms-history";
import type { TermsHistoryRow } from "@/features/partners/lib/commercial-terms";

const row = (change: Partial<TermsHistoryRow> = {}): TermsHistoryRow => ({
  id: "t-3",
  label: "v3",
  effective_date: "1 Oct 2026",
  partner_share: "30%",
  launch_share: "50%",
  changed_by: "Priya Nair",
  is_current: true,
  ...change,
});

const render = (rows: TermsHistoryRow[], truncated = false, currentLabel: string | null = "v3") =>
  renderToStaticMarkup(createElement(CommercialTermsHistory, { rows, currentLabel, truncated, limit: 100 }));

describe("CommercialTermsHistory", () => {
  it("should be the Terms history card, read only", () => {
    const html = render([row()]);

    expect(html).toContain("Terms history");
    expect(html).toContain("Read only · Earlier versions are retained");
    expect(html).not.toMatch(/<input|<button|<form/);
  });

  it("should have the columns of the design", () => {
    const html = render([row()]);

    for (const column of ["Version", "Effective date", "Partner share", "Launch share", "Changed by"]) {
      expect(html).toContain(`>${column}<`);
    }
  });

  it("should list each version in the order it is given, with who changed it (AC01)", () => {
    const html = render([
      row(),
      row({ id: "t-2", label: "v2", effective_date: "1 Sep 2026", changed_by: "Admin", is_current: false }),
    ]);

    expect(html).toContain("1 Oct 2026");
    expect(html).toContain("Priya Nair");
    expect(html.indexOf("1 Oct 2026")).toBeLessThan(html.indexOf("1 Sep 2026"));
  });

  it("should mark only the version in force and name it under the table", () => {
    const html = render([row(), row({ id: "t-2", label: "v2", is_current: false })]);

    expect(html.match(/aria-label="Current terms"/g)).toHaveLength(1);
    expect(html).toContain("Current terms · V3");
  });

  it("should say there are no terms yet when the list is empty", () => {
    const html = render([], false, null);

    expect(html).toContain("No terms yet.");
    expect(html).not.toContain("Current terms ·");
  });

  it("should note that older versions were cut off, with the limit", () => {
    expect(render([row()], true)).toContain("Only the latest 100 versions are shown.");
    expect(render([row()], false)).not.toContain("Only the latest");
  });
});
