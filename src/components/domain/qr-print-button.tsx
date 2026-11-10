"use client"

import { PrinterIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** Opens the browser print dialog; the page hides everything but the card with `print:` classes. */
function QrPrintButton({ label = "Print", className }: { label?: string; className?: string }) {
  return (
    <Button type="button" variant="outline" className={cn(className)} onClick={() => window.print()}>
      <PrinterIcon data-icon="inline-start" aria-hidden="true" />
      {label}
    </Button>
  )
}

export { QrPrintButton }
