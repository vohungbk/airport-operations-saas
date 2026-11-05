import { z } from "zod";

import { ConfigurationError } from "@/lib/config/env";

/**
 * Server-only secrets of the system jobs (VI-F02-S03). None has a `NEXT_PUBLIC_` prefix, so neither
 * reaches the browser. The error names the variable, never its value.
 */
const non_empty = z.string().trim().min(1);

type ConfigSource = Record<string, string | undefined>;

function read(name: string, value: string | undefined): string {
  const result = non_empty.safeParse(value);

  if (!result.success) {
    throw new ConfigurationError(`Invalid configuration: set a value for ${name}.`);
  }

  return result.data;
}

/** The key of the service role. It bypasses RLS: only the system jobs use it (docs/security.md). */
export function getServiceRoleKey(config_source: ConfigSource = process.env): string {
  return read("SUPABASE_SERVICE_ROLE_KEY", config_source.SUPABASE_SERVICE_ROLE_KEY);
}

/** The secret a scheduler sends to start a system job. */
export function getCronSecret(config_source: ConfigSource = process.env): string {
  return read("CRON_SECRET", config_source.CRON_SECRET);
}
