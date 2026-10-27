import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SeatQrCard } from "@/features/seats/components/seat-qr-card";

const SEAT_ID = "e0000000-0000-0000-0000-000000000008";

const render = (props: Partial<{ serialNumber: string; publicToken: string }> = {}) =>
  renderToStaticMarkup(
    createElement(SeatQrCard, {
      seatId: SEAT_ID,
      serialNumber: "SEAT-0008",
      publicToken: "00000000-0000-4000-8000-0000000000a1",
      ...props,
    }),
  );

describe("SeatQrCard", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("should show the QR image with an accessible name (AC01)", () => {
    const html = render();

    expect(html).toContain("<svg");
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="QR code of seat SEAT-0008"');
  });

  it("should link Download to the seat's QR route, as a download (AC03)", () => {
    const html = render();

    expect(html).toContain(`href="/api/seats/${SEAT_ID}/qr"`);
    expect(html).toContain("download");
    expect(html).toContain(">Download<");
    expect(html).toContain(">Print<");
  });

  it("should print only the code and the serial number, hiding the heading, the note and the buttons", () => {
    const html = render();

    expect(html.match(/print:hidden/g)?.length).toBe(3);
  });

  it("should show the same image whatever the serial number says (AC04)", () => {
    const svgOf = (html: string) => html.slice(html.indexOf("<svg"), html.indexOf("</svg>"));

    expect(svgOf(render({ serialNumber: "SEAT-0008" }))).toBe(svgOf(render({ serialNumber: "RENAMED-1" })));
  });

  it("should show a notice, not fail the page, when the public address is not set in production", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("NODE_ENV", "production");

    const html = render();

    expect(html).toContain("NEXT_PUBLIC_APP_URL");
    expect(html).not.toContain("<svg");
  });

  it("should refuse a token that cannot be put in an address", () => {
    expect(() => render({ publicToken: "a/b" })).toThrow();
  });
});
