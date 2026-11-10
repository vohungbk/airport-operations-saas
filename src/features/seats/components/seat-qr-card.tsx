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
      <section className="w-full min-w-0 flex-1 rounded-xl border border-border bg-surface p-5 text-sm text-muted-foreground print:hidden">
        The QR code is not available: the public address of the app is not set (NEXT_PUBLIC_APP_URL).
      </section>
    );
  }

  return (
    <section
      aria-labelledby="seat-qr-heading"
      className="flex w-full min-w-0 flex-1 flex-col gap-4 rounded-xl border border-border bg-surface p-5 print:border-0 print:p-0"
    >
      <h2 id="seat-qr-heading" className="text-base leading-snug font-semibold text-foreground print:hidden">
        Seat QR
      </h2>
      <QrCodeCard
        svg={svg}
        seat_id={serialNumber}
        download_href={`/api/seats/${seatId}/qr`}
        action_class_name="min-h-11 bg-surface dark:bg-surface"
        className="max-w-none bg-transparent py-0 ring-0 [&_[data-slot=card-content]]:items-center [&_[role=img]]:w-42 [&_p]:text-center"
      />
    </section>
  );
}
