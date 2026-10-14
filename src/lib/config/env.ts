import { z } from "zod";

/**
 * Raised when a required environment variable is missing or invalid.
 * The message lists variable NAMES only — never their values — so it is
 * safe to surface in logs and error pages.
 */
export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

const ENV_VAR_NAMES: Record<string, string> = {
  supabase_url: "NEXT_PUBLIC_SUPABASE_URL",
  supabase_publishable_key: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
};

const publicEnvSchema = z.object({
  supabase_url: z.url({ protocol: /^https?$/ }),
  supabase_publishable_key: z.string().trim().min(1),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

/**
 * Validated public configuration. Only `NEXT_PUBLIC_*` values live here,
 * because they are the only ones that may reach the browser.
 *
 * Each variable is read with a literal `process.env.NEXT_PUBLIC_*` access
 * on purpose: Next.js inlines them at build time and does not inline
 * dynamic lookups such as `process.env[name]`.
 */
export function getPublicEnv(): PublicEnv {
  const result = publicEnvSchema.safeParse({
    supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabase_publishable_key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });

  if (result.success) {
    return result.data;
  }

  const names = [
    ...new Set(
      result.error.issues.map((issue) => {
        const field = String(issue.path[0]);
        return ENV_VAR_NAMES[field] ?? field;
      }),
    ),
  ];

  throw new ConfigurationError(
    `Invalid configuration: set a valid value for ${names.join(", ")}. ` +
      "Copy .env.example to .env.local and fill in the Supabase project values.",
  );
}
