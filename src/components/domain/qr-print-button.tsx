"use client"

import { PrinterIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

/** Opens the browser print dialog; the page hides everything but the card with `print:` classes. */
function QrPrintButton({ label = "Print" }: { label?: string }) {
  return (
    <Button type="button" variant="outline" onClick={() => window.print()}>
      <PrinterIcon data-icon="inline-start" aria-hidden="true" />
      {label}
    </Button>
  )
}

export { QrPrintButton }
