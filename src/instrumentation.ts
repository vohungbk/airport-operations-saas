import { getPublicEnv } from "@/lib/config/env";

/**
 * Runs once when the Next.js server starts. Validating here makes a
 * missing or invalid environment variable fail at startup with a clear
 * configuration error, instead of surfacing on the first request.
 */
export function register() {
  getPublicEnv();
}
