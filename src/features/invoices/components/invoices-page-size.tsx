"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buildInvoicesHref } from "@/features/invoices/lib/build-invoices-href";
import {
  INVOICES_PAGE_SIZES,
  type ResolvedInvoicesQuery,
} from "@/features/invoices/schemas/invoices-query.schema";

interface InvoicesPageSizeProps {
  query: ResolvedInvoicesQuery;
}

/** The "10 per page" menu of the design: a new size goes back to page 1 with every filter kept. */
export function InvoicesPageSize({ query }: InvoicesPageSizeProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button type="button" variant="outline" className="min-h-11 px-4" aria-label="Invoices per page" />}
      >
        {query.page_size} per page
        <ChevronDown aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {INVOICES_PAGE_SIZES.map((size) => (
          <DropdownMenuItem key={size} render={<Link href={buildInvoicesHref(query, { page_size: size, page: 1 })} />}>
            {size} per page
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
