import qrcode from "qrcode-generator";
import { z } from "zod";

import { SEAT_QR_PATH_PREFIX } from "@/lib/constants/routes";

/** The token is a UUID as text today; the limit keeps a bad value out of a code. */
const publicTokenSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9-]+$/, "The public token has a character a QR address cannot hold.");

/**
 * What a seat QR code holds (CO-F04-S12, PO Decision Log): the address of the seat scan page
 * and the public token, and nothing else. No serial number, no id, no partner, no booking,
 * no status. The code identifies the seat; it grants no access (PRD v1.1, section 20.2).
 * Throws on a token that is not safe to put in an address.
 */
export function seatQrPayload(appUrl: string, publicToken: string): string {
  const token = publicTokenSchema.parse(publicToken);
  return `${appUrl.replace(/\/+$/, "")}${SEAT_QR_PATH_PREFIX}/${token}`;
}

/**
 * The QR code as a scalable SVG. Pure: the same payload always gives the same image, so a seat
 * keeps its code however its other data changes (AC04). Error correction M, quiet zone of 4.
 */
export function renderSeatQrSvg(payload: string): string {
  const code = qrcode(0, "M");
  code.addData(payload);
  code.make();
  return code.createSvgTag({ cellSize: 8, margin: 4, scalable: true });
}

/** The name of the downloaded file. The serial is stripped to characters a file name allows. */
export function seatQrFileName(serialNumber: string): string {
  const safe = serialNumber.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return `seat-${safe || "qr"}-qr.svg`;
}
