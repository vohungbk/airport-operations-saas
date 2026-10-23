import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import SeatQrNotFound from "@/app/(dashboard)/q/[token]/not-found";

describe("SeatQrNotFound", () => {
  it("should say the code does not match a seat the user can open, and not say why", () => {
    const html = renderToStaticMarkup(createElement(SeatQrNotFound));

    expect(html).toContain("Seat not found");
    expect(html).toContain("does not match a seat you can open");
    expect(html).not.toMatch(/forged|scope|tenant|partner/i);
    expect(html).toContain('href="/dashboard"');
  });
});
