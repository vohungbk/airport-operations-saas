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

interface InvoiceRowMenuProps {
  id: string;
  invoice_number: string;
}

/**
 * The menu of a row (VI-F09-S01). It opens the invoice; "Download PDF" of the design is not here because
 * no PDF is stored yet (another ticket).
 */
export function InvoiceRowMenu({ id, invoice_number }: InvoiceRowMenuProps) {
  return (
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
