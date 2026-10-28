import { publicTokenSchema } from "@/features/seats/lib/seat-qr";
import { SEAT_QR_PATH_PREFIX } from "@/lib/constants/routes";

/**
 * Pure logic for the seat scan (UI-F07-S02, spec R2, R9, E2). A scan only names a seat; it performs
 * nothing. What a QR code holds is the address of the seat scan page with the public token (CO-F04-S12),
 * and a technician who cannot use the camera types the serial number of the seat.
 */

export type ScannedCode =
  | { kind: "token"; token: string }
  | { kind: "serial"; serial: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * What a read or typed text names: the public token (from the address a QR code holds, or the bare token), or
 * a serial number. `null` for empty text, an address that is not a seat scan page, or a token a code cannot
 * hold.
 */
export function parseScannedCode(raw: string): ScannedCode | null {
  const text = raw.trim();
  if (!text) return null;

  if (/^https?:\/\//i.test(text)) {
    let pathname: string;
    try {
      pathname = new URL(text).pathname;
    } catch {
      return null;
    }
    const [, prefix, token, ...rest] = pathname.split("/");
    const parsed = publicTokenSchema.safeParse(token);

    return `/${prefix}` === SEAT_QR_PATH_PREFIX && rest.length === 0 && parsed.success
      ? { kind: "token", token: parsed.data }
      : null;
  }

  return UUID.test(text) ? { kind: "token", token: text } : { kind: "serial", serial: text };
}
