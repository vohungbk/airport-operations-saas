import { describe, expect, it } from "vitest";

import {
  buildGaInitScript,
  buildGaScriptSrc,
  getGaMeasurementId,
} from "@/lib/analytics/google-analytics";

describe("getGaMeasurementId", () => {
  it("should return the ID when it has the G-XXXXXXX form", () => {
    expect(getGaMeasurementId("G-ABC123XYZ9")).toBe("G-ABC123XYZ9");
  });

  it("should trim spaces around a valid ID", () => {
    expect(getGaMeasurementId("  G-ABC123XYZ9  ")).toBe("G-ABC123XYZ9");
  });

  it("should return null when the variable is missing or empty", () => {
    expect(getGaMeasurementId("")).toBeNull();
    expect(getGaMeasurementId("   ")).toBeNull();
  });

  it("should return null when the value is not a GA4 Measurement ID", () => {
    expect(getGaMeasurementId("UA-12345-1")).toBeNull();
    expect(getGaMeasurementId("g-abc123xyz9")).toBeNull();
    expect(getGaMeasurementId('G-ABCD"></script>')).toBeNull();
  });
});

describe("buildGaScriptSrc", () => {
  it("should point to gtag.js with the Measurement ID", () => {
    expect(buildGaScriptSrc("G-ABC123XYZ9")).toBe(
      "https://www.googletagmanager.com/gtag/js?id=G-ABC123XYZ9",
    );
  });
});

describe("buildGaInitScript", () => {
  it("should configure gtag with the Measurement ID", () => {
    const script = buildGaInitScript("G-ABC123XYZ9");

    expect(script).toContain('gtag("config","G-ABC123XYZ9"');
  });

  it("should switch off Google signals and ad personalisation", () => {
    const script = buildGaInitScript("G-ABC123XYZ9");

    expect(script).toContain('"allow_google_signals":false');
    expect(script).toContain('"allow_ad_personalization_signals":false');
  });
});
