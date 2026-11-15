import { describe, expect, it } from "vitest";

import { isWebhookSignatureValid, signWebhookBody } from "@/features/bookings/lib/verify-webhook-signature";

const SECRET = "a-secret-of-at-least-32-characters-long";
const BODY = '{"external_booking_number":"EXT-1"}';

describe("isWebhookSignatureValid (CO-F07-S09)", () => {
  it("should accept the signature of the exact body under the secret", () => {
    expect(isWebhookSignatureValid(BODY, signWebhookBody(BODY, SECRET), SECRET)).toBe(true);
  });

  it.each([
    ["a header that is missing", null],
    ["an empty header", ""],
    ["a signature under another secret", signWebhookBody(BODY, "another-secret-of-at-least-32-chars!")],
    ["a signature of another body", signWebhookBody('{"external_booking_number":"EXT-2"}', SECRET)],
    ["a signature without the prefix", signWebhookBody(BODY, SECRET).replace("sha256=", "")],
  ])("should refuse %s", (_name, header) => {
    expect(isWebhookSignatureValid(BODY, header, SECRET)).toBe(false);
  });
});
