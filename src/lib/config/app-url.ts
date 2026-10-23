import { z } from "zod";

import { ConfigurationError } from "@/lib/config/env";

const DEVELOPMENT_APP_URL = "http://localhost:3000";

const appUrlSchema = z.url({ protocol: /^https?$/ });

/**
 * The public address of the app, for the links a QR code carries (CO-F04-S12). A QR code is
 * printed and permanent, so its address must not depend on the request that made it: it comes
 * from `NEXT_PUBLIC_APP_URL`. It is required in production; elsewhere it falls back to the
 * local development address. Without a trailing slash. Names only in the error, never values.
 */
export function getAppUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      throw new ConfigurationError(
        "Invalid configuration: set a valid value for NEXT_PUBLIC_APP_URL.",
      );
    }
    return DEVELOPMENT_APP_URL;
  }

  if (!appUrlSchema.safeParse(raw).success) {
    throw new ConfigurationError(
      "Invalid configuration: set a valid value for NEXT_PUBLIC_APP_URL.",
    );
  }

  return raw.replace(/\/+$/, "");
}
