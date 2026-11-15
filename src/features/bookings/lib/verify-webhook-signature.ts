import { createHmac } from "node:crypto";

import { safeEqual } from "@/lib/security/safe-equal";

/** The header value for a body: `sha256=<hex of HMAC-SHA256(secret, raw body)>`. The sender and the tests use it. */
export function signWebhookBody(raw_body: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(raw_body).digest("hex")}`;
}

/**
 * CO-F07-S09 (R12): true when the signature header is the signature of this exact body under the secret.
 */
export function isWebhookSignatureValid(
  raw_body: string,
  signature_header: string | null,
  secret: string,
): boolean {
  if (!signature_header) return false;

  return safeEqual(signature_header.trim(), signWebhookBody(raw_body, secret));
}
