import { describe, expect, it } from "vitest";

import {
  renderSeatQrSvg,
  seatQrFileName,
  seatQrPayload,
} from "@/features/seats/lib/seat-qr";

const TOKEN = "5e2a2c8e-8f7c-4d3c-9d3f-1f7f5b5b7c11";
const APP_URL = "https://app.example.com";

describe("seatQrPayload", () => {
  it("should hold the address of the scan page and the public token, nothing else (AC02)", () => {
    expect(seatQrPayload(APP_URL, TOKEN)).toBe(`https://app.example.com/q/${TOKEN}`);
  });

  it("should not double the slash when the address ends with one", () => {
    expect(seatQrPayload("https://app.example.com/", TOKEN)).toBe(`https://app.example.com/q/${TOKEN}`);
  });

  it.each([
    ["an empty token", ""],
    ["a token with a slash", "abc/def"],
    ["a token with a query", "abc?x=1"],
    ["a token with a space", "abc def"],
    ["a token that is too long", "a".repeat(129)],
  ])("should refuse %s", (_name, token) => {
    expect(() => seatQrPayload(APP_URL, token)).toThrow();
  });
});

describe("renderSeatQrSvg", () => {
  const payload = seatQrPayload(APP_URL, TOKEN);

  it("should produce a scalable SVG", () => {
    const svg = renderSeatQrSvg(payload);

    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("viewBox");
    expect(svg.trimEnd().endsWith("</svg>")).toBe(true);
  });

  it("should give the same image for the same payload, so the code of a seat never changes (AC04)", () => {
    expect(renderSeatQrSvg(payload)).toBe(renderSeatQrSvg(payload));
  });

  it("should give another image for another token", () => {
    expect(renderSeatQrSvg(payload)).not.toBe(
      renderSeatQrSvg(seatQrPayload(APP_URL, "00000000-0000-4000-8000-000000000001")),
    );
  });

  it("should not write the address, the token or any text into the image (AC02)", () => {
    const svg = renderSeatQrSvg(payload);

    expect(svg).not.toContain(TOKEN);
    expect(svg).not.toContain("example.com");
    expect(svg).not.toMatch(/<text|<title|<desc/);
  });
});

describe("seatQrFileName", () => {
  it("should name the file after the serial number", () => {
    expect(seatQrFileName("SEAT-0001")).toBe("seat-SEAT-0001-qr.svg");
  });

  it.each([
    ["a path", "../../etc/passwd", "seat-etc-passwd-qr.svg"],
    ["a quote and a line break", 'A"\nB', "seat-A-B-qr.svg"],
    ["nothing usable", "///", "seat-qr-qr.svg"],
  ])("should keep only safe characters for %s", (_name, serial, expected) => {
    expect(seatQrFileName(serial)).toBe(expected);
  });
});
