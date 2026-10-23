import type { Metadata } from "next";

/**
 * CO-F04-S14: the address of a scan holds the public token of a seat. It must not be indexed,
 * and must not travel to another site in a Referer header.
 */
export const SEAT_QR_PAGE_METADATA: Metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
