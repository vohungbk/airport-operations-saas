import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FlightBoardBanners } from "./flight-board-banners";

describe("FlightBoardBanners", () => {
  it("should write the title and the line of each alert", () => {
    const html = renderToStaticMarkup(
      createElement(FlightBoardBanners, {
        alerts: [{ key: "k1", kind: "early", title: "ARRIVING 45 MINUTES EARLY", detail: "EK 203 · Asia/Dubai." }],
      }),
    );

    expect(html).toContain("ARRIVING 45 MINUTES EARLY");
    expect(html).toContain("EK 203 · Asia/Dubai.");
    expect(html).toContain('aria-label="Flight alerts"');
  });

  it("should render nothing when there is no alert", () => {
    expect(renderToStaticMarkup(createElement(FlightBoardBanners, { alerts: [] }))).toBe("");
  });
});
