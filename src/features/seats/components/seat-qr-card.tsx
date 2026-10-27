import { QrCodeCard } from "@/components/domain/qr-code-card";
import { renderSeatQrSvg, seatQrPayload } from "@/features/seats/lib/seat-qr";
import { getAppUrl } from "@/lib/config/app-url";
import { ConfigurationError } from "@/lib/config/env";

interface SeatQrCardProps {
  seatId: string;
  serialNumber: string;
  publicToken: string;
}

/**
 * CO-F04-S12: the permanent QR code of a seat, drawn on the server from its public token
 * (AC01), with Download (AC03) and Print. The serial number is printed under the code so staff
 * can read it; it is not part of the code (AC02). The card is the shared `QrCodeCard` (UI-F06-S02); this
 * part only makes the code from the seat. The image brings its own white background and quiet zone, so
 * it scans in the dark theme too.
 */
export function SeatQrCard({ seatId, serialNumber, publicToken }: SeatQrCardProps) {
  let svg: string;
  try {
    svg = renderSeatQrSvg(seatQrPayload(getAppUrl(), publicToken));
  } catch (error) {
    // A missing address must not take the whole seat page down; only the code is unavailable.
    if (!(error instanceof ConfigurationError)) throw error;
    return (
      <section className="max-w-xs rounded-lg border border-border p-4 text-sm text-muted-foreground print:hidden">
        The QR code is not available: the public address of the app is not set (NEXT_PUBLIC_APP_URL).
      </section>
    );
  }

  return (
    <section aria-labelledby="seat-qr-heading" className="flex max-w-xs flex-col gap-2">
      <h2 id="seat-qr-heading" className="text-sm font-medium text-foreground print:hidden">
        QR code
      </h2>
      <QrCodeCard svg={svg} seat_id={serialNumber} download_href={`/api/seats/${seatId}/qr`} />
    </section>
  );
}
