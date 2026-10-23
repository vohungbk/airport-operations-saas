"use client";

import { Button } from "@/components/ui/button";

interface PrintButtonProps {
  label: string;
}

/** Opens the browser print dialog; the page hides everything but the QR card with `print:` classes. */
export function PrintButton({ label }: PrintButtonProps) {
  return (
    <Button type="button" variant="outline" onClick={() => window.print()}>
      {label}
    </Button>
  );
}
