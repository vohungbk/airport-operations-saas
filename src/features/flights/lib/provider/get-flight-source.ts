import { createSandboxAdapter, createSimulatorAdapter } from "./fixture-adapters";
import type { FlightSourceAdapter } from "./flight-source";
import { createProviderAdapter } from "./provider-adapter";
import { getFlightSourceConfig, type ConfigSource } from "./provider-config";

/**
 * Server-only. The one place that picks the adapter, from configuration alone (spec R11): the code
 * that reads a flight asks for the source and never branches on which one it got.
 */
export function getFlightSource(config_source: ConfigSource = process.env): FlightSourceAdapter {
  const config = getFlightSourceConfig(config_source);

  switch (config.source) {
    case "provider":
      return createProviderAdapter({ base_url: config.base_url, provider_key: config.provider_key });
    case "sandbox":
      return createSandboxAdapter();
    case "simulator":
      return createSimulatorAdapter();
  }
}
