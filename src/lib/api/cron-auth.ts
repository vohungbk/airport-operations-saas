import { z } from "zod";

import { safeEqual } from "@/lib/security/safe-equal";

const bearerSchema = z.string().regex(/^Bearer\s+\S+$/);

/**
 * True when the `Authorization` header is `Bearer <token>` and the token is the expected one. The two sides are hashed
 * first so the comparison takes the same time whatever the guess, and a wrong length does not leak.
 */
export function isCronAuthorized(authorization: string | null, expected_token: string): boolean {
  const parsed = bearerSchema.safeParse(authorization?.trim());
  if (!parsed.success) return false;

  const token = parsed.data.replace(/^Bearer\s+/, "");
  return safeEqual(token, expected_token);
}
