"use client"

import { PrinterIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** Opens the browser print dialog; the page hides everything but the card with `print:` classes. */
function QrPrintButton({
  label = "Print",
  variant = "outline",
  show_icon = true,
  className,
}: {
  label?: string;
  variant?: "outline" | "default";
  show_icon?: boolean;
  className?: string;
}) {
  return (
    <Button type="button" variant={variant} className={cn(className)} onClick={() => window.print()}>
      {show_icon && <PrinterIcon data-icon="inline-start" aria-hidden="true" />}
      {label}
    </Button>
  )
}

export { QrPrintButton }
