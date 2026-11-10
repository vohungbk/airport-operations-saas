import Link from "next/link";
import { DownloadIcon } from "lucide-react";

import { QrPrintButton } from "@/components/domain/qr-print-button";
import { buttonVariants } from "@/components/ui/button";
import { renderSeatQrSvg, seatQrPayload } from "@/features/seats/lib/seat-qr";
import { getAppUrl } from "@/lib/config/app-url";
import { ConfigurationError } from "@/lib/config/env";
import { cn } from "@/lib/utils";

interface SeatQrPrintProps {
  seatId: string;
  serialNumber: string;
  publicToken: string;
}

/**
 * The print-ready label of a seat: the QR code and the serial number on a white card. On paper only
 * the card is printed; the header and the buttons are hidden. The code is drawn on the server from the
 * public token, as on the seat detail (CO-F04-S12).
 */
export function SeatQrPrint({ seatId, serialNumber, publicToken }: SeatQrPrintProps) {
  let svg: string | null = null;
  try {
    svg = renderSeatQrSvg(seatQrPayload(getAppUrl(), publicToken));
  } catch (error) {
    if (!(error instanceof ConfigurationError)) throw error;
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex items-start gap-4 print:hidden">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="text-2xl leading-tight font-semibold text-foreground">
            {serialNumber} · QR Print
          </h1>
          <p className="text-sm leading-5 text-text-muted">
            Print-ready label for seat {serialNumber}
          </p>
        </div>
        {svg && <QrPrintButton label="Print" variant="default" show_icon={false} className="min-h-11 min-w-[110px]" />}
      </div>

      {svg ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 py-8 print:py-0">
          <section
            aria-label={`QR label of seat ${serialNumber}`}
            className="flex w-full max-w-sm flex-col items-center gap-4 rounded-xl border border-border bg-white p-8 print:border-0"
          >
            <div
              role="img"
              aria-label={`QR code of seat ${serialNumber}`}
              className="w-48 max-w-full [&>svg]:h-auto [&>svg]:w-full"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
            <p className="min-w-0 break-words text-center font-mono text-sm font-semibold text-slate-900">
              {serialNumber}
            </p>
          </section>
          <div className="flex flex-wrap items-center justify-center gap-2 print:hidden">
            <a
              href={`/api/seats/${seatId}/qr`}
              download
              className={cn(buttonVariants({ variant: "default" }), "min-h-11")}
            >
              <DownloadIcon data-icon="inline-start" aria-hidden="true" />
              Download image
            </a>
            <Link
              href={`/seats/${seatId}`}
              className={cn(buttonVariants({ variant: "outline" }), "min-h-11 bg-surface dark:bg-surface")}
            >
              Back to seat detail
            </Link>
          </div>
        </div>
      ) : (
        <section className="rounded-xl border border-border bg-surface p-5 text-sm text-muted-foreground print:hidden">
          The QR code is not available: the public address of the app is not set (NEXT_PUBLIC_APP_URL).
        </section>
      )}
    </div>
  );
}
