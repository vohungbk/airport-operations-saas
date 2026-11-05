import { describe, expect, it } from "vitest";

import { ConfigurationError } from "@/lib/config/env";

import { getFlightSourceConfig } from "./provider-config";

describe("getFlightSourceConfig", () => {
  it("should default to the simulator when no source is set", () => {
    expect(getFlightSourceConfig({})).toEqual({ source: "simulator" });
  });

  it("should accept the source in any letter case", () => {
    expect(getFlightSourceConfig({ FLIGHT_SOURCE: " Sandbox " })).toEqual({ source: "sandbox" });
  });

  it("should return the sandbox source without needing credentials", () => {
    expect(getFlightSourceConfig({ FLIGHT_SOURCE: "sandbox" })).toEqual({ source: "sandbox" });
  });

  it("should return the provider source with its base url and key", () => {
    expect(
      getFlightSourceConfig({
        FLIGHT_SOURCE: "provider",
        FLIGHT_PROVIDER_BASE_URL: "https://api.example.com",
        FLIGHT_PROVIDER_API_KEY: "secret-key",
      }),
    ).toEqual({ source: "provider", base_url: "https://api.example.com", provider_key: "secret-key" });
  });

  it("should throw a configuration error when the provider has no key", () => {
    expect(() =>
      getFlightSourceConfig({
        FLIGHT_SOURCE: "provider",
        FLIGHT_PROVIDER_BASE_URL: "https://api.example.com",
      }),
    ).toThrow(ConfigurationError);
  });

  it("should name the missing variables and never print their values", () => {
    const hidden_text = "do-not-print-me";
    const config = {
      FLIGHT_SOURCE: "provider",
      FLIGHT_PROVIDER_BASE_URL: "not a url",
      FLIGHT_PROVIDER_API_KEY: hidden_text,
    };

    expect(() => getFlightSourceConfig(config)).toThrow(/FLIGHT_PROVIDER_BASE_URL/);
    expect(() => getFlightSourceConfig(config)).not.toThrow(new RegExp(`${hidden_text}|not a url`));
  });

  it("should throw a configuration error when the source is not one of the three", () => {
    expect(() => getFlightSourceConfig({ FLIGHT_SOURCE: "radar" })).toThrow(/FLIGHT_SOURCE/);
  });
});
