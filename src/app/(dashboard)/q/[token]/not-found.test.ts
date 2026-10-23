import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import SeatQrNotFound, { metadata } from "@/app/(dashboard)/q/[token]/not-found";

describe("SeatQrNotFound", () => {
  it("should not be indexed and should send no referrer either", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.referrer).toBe("no-referrer");
  });

  it("should say the code does not match a seat the user can open, and not say why", () => {
    const html = renderToStaticMarkup(createElement(SeatQrNotFound));

    expect(html).toContain("Seat not found");
    expect(html).toContain("does not match a seat you can open");
    expect(html).not.toMatch(/forged|scope|tenant|partner/i);
    expect(html).toContain('href="/dashboard"');
  });
});
