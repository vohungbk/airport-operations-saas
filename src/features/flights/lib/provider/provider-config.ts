import { z } from "zod";

import { ConfigurationError } from "@/lib/config/env";

import { FLIGHT_SOURCES, type FlightSource } from "./flight-source";

/**
 * VI-F02-S09 (spec R11, R14): which flight source is active, from server environment variables.
 * None has a `NEXT_PUBLIC_` prefix, so the base URL and the key never reach the browser. Going to
 * production is a change of these values and a restart, not a build.
 */
const VARIABLE_NAMES: Record<string, string> = {
  source: "FLIGHT_SOURCE",
  base_url: "FLIGHT_PROVIDER_BASE_URL",
  provider_key: "FLIGHT_PROVIDER_API_KEY",
};

const configSchema = z.discriminatedUnion("source", [
  z.object({
    source: z.literal("provider"),
    base_url: z.url({ protocol: /^https?$/ }),
    provider_key: z.string().trim().min(1),
  }),
  z.object({ source: z.literal("sandbox") }),
  z.object({ source: z.literal("simulator") }),
]);

export type FlightSourceConfig = z.infer<typeof configSchema>;

/** Without credentials the app runs on the simulator (spec: works with test data). */
export const DEFAULT_FLIGHT_SOURCE: FlightSource = "simulator";

export type ConfigSource = Record<string, string | undefined>;

/**
 * Validated flight source configuration. The error names the variables, never their values.
 */
export function getFlightSourceConfig(config_source: ConfigSource = process.env): FlightSourceConfig {
  const result = configSchema.safeParse({
    source: config_source.FLIGHT_SOURCE?.trim().toLowerCase() || DEFAULT_FLIGHT_SOURCE,
    base_url: config_source.FLIGHT_PROVIDER_BASE_URL,
    provider_key: config_source.FLIGHT_PROVIDER_API_KEY,
  });

  if (result.success) {
    return result.data;
  }

  const names = [
    ...new Set(
      result.error.issues.map((issue) => {
        const field = String(issue.path[0]);
        return VARIABLE_NAMES[field] ?? field;
      }),
    ),
  ];

  throw new ConfigurationError(
    `Invalid flight source configuration: set a valid value for ${names.join(", ")}. ` +
      `FLIGHT_SOURCE is one of ${FLIGHT_SOURCES.join(", ")}.`,
  );
}
