"use client";

import { MoreHorizontal } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useInvoicePdf } from "@/features/invoices/hooks/use-invoice-pdf";

interface InvoiceRowMenuProps {
  id: string;
  invoice_number: string;
}

/**
 * The menu of a row (VI-F09-S01, S04): it opens the invoice, or downloads it as a PDF. A failed download is
 * said next to the menu, and the item can be chosen again.
 */
export function InvoiceRowMenu({ id, invoice_number }: InvoiceRowMenuProps) {
  const { download, isPending, error } = useInvoicePdf(id, invoice_number);

  return (
    <div className="flex flex-col items-start gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="min-h-11 min-w-11"
              aria-label={`Actions for ${invoice_number}`}
            />
          }
        >
          <MoreHorizontal aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem render={<Link href={`/invoices/${id}`} />}>View invoice</DropdownMenuItem>
          <DropdownMenuItem disabled={isPending} onClick={download}>
            {isPending ? "Preparing PDF…" : "Download PDF"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {error && (
        <p role="alert" className="max-w-48 text-xs text-danger-fg">
          {error}
        </p>
      )}
    </div>
  );
}
