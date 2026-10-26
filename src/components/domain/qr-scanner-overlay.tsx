import { CameraOffIcon, FlashlightIcon, FlashlightOffIcon } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ScannerCameraState = "starting" | "ready" | "denied"

interface QrScannerOverlayProps {
  camera: ScannerCameraState
  torch_on?: boolean
  on_torch_toggle?: () => void
  /** Where the person types the code by hand. Always offered, and the only way on when the camera is denied. */
  type_code_href: string
  className?: string
}

const CORNERS = [
  "top-0 left-0 border-t-4 border-l-4 rounded-tl-lg",
  "top-0 right-0 border-t-4 border-r-4 rounded-tr-lg",
  "bottom-0 left-0 border-b-4 border-l-4 rounded-bl-lg",
  "bottom-0 right-0 border-b-4 border-r-4 rounded-br-lg",
]

/** Frame, corners, torch and the type-the-code link over the camera view (spec R4, E3). It never opens the camera. */
function QrScannerOverlay({ camera, torch_on = false, on_torch_toggle, type_code_href, className }: QrScannerOverlayProps) {
  const denied = camera === "denied"
  const TorchIcon = torch_on ? FlashlightOffIcon : FlashlightIcon

  return (
    <div
      data-slot="qr-scanner-overlay"
      data-camera={camera}
      className={cn("flex min-w-0 flex-col items-center gap-4 rounded-lg border border-border bg-muted p-4 text-foreground", className)}
    >
      {denied ? (
        <div role="alert" className="flex min-w-0 flex-col items-center gap-2 py-6 text-center text-sm">
          <CameraOffIcon className="size-8" aria-hidden="true" />
          <p className="font-medium">Camera access is not allowed.</p>
          <p className="text-muted-foreground">Allow the camera in your browser settings, or type the code instead.</p>
        </div>
      ) : (
        <div data-slot="qr-scanner-frame" className="relative aspect-square w-full max-w-64">
          {CORNERS.map((corner) => (
            <span key={corner} aria-hidden="true" className={cn("absolute size-10 border-foreground", corner)} />
          ))}
          <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-muted-foreground">
            {camera === "starting" ? "Starting the camera..." : "Point the camera at the seat QR code."}
          </p>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {!denied && (
          <Button
            type="button"
            variant="secondary"
            disabled={camera !== "ready"}
            onClick={on_torch_toggle}
          >
            <TorchIcon data-icon="inline-start" aria-hidden="true" />
            {torch_on ? "Torch off" : "Torch on"}
          </Button>
        )}
        <a
          href={type_code_href}
          data-slot="type-the-code-link"
          className={buttonVariants({ variant: "secondary" })}
        >
          Type the code instead
        </a>
      </div>
    </div>
  )
}

export { QrScannerOverlay }
export type { QrScannerOverlayProps, ScannerCameraState }
