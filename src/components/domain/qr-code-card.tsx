import { DownloadIcon, LockIcon } from "lucide-react"

import { QrPrintButton } from "@/components/domain/qr-print-button"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface QrCodeCardProps {
  /** The code as an SVG string drawn by the caller (`renderSeatQrSvg`); it is never built from user text. */
  svg: string
  /** Printed under the code so staff can read it. */
  seat_id: string
  download_href: string
  className?: string
}

/**
 * The code, the seat ID, Download and Print, and a note that the code alone grants no access (spec R4).
 * On paper only the code and the seat ID are printed: the note and the buttons are not part of a label.
 */
function QrCodeCard({ svg, seat_id, download_href, className }: QrCodeCardProps) {
  return (
    <Card data-slot="qr-code-card" className={cn("min-w-0 max-w-xs", className)}>
      <CardContent className="flex min-w-0 flex-col gap-3">
        <div
          role="img"
          aria-label={`QR code of seat ${seat_id}`}
          className="w-full rounded-md [&>svg]:h-auto [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <p className="min-w-0 break-words text-center font-mono text-sm text-foreground">{seat_id}</p>
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground print:hidden">
          <LockIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          Sign-in is needed to see this seat. The code alone gives no access.
        </p>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <a href={download_href} download className={buttonVariants({ variant: "outline" })}>
            <DownloadIcon data-icon="inline-start" aria-hidden="true" />
            Download
          </a>
          <QrPrintButton />
        </div>
      </CardContent>
    </Card>
  )
}

export { QrCodeCard }
export type { QrCodeCardProps }
