"use client";

import { useRouter } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildPartnersHref } from "@/features/partners/lib/build-partners-href";
import {
  PARTNERS_PAGE_SIZE_OPTIONS,
  type PartnersQuery,
} from "@/features/partners/schemas/partners-query.schema";

interface PartnersRowsPerPageProps {
  query: PartnersQuery;
}

const ITEMS = PARTNERS_PAGE_SIZE_OPTIONS.map((size) => ({
  value: String(size),
  label: String(size),
}));

/** "Rows per page": a change goes to the address and back to page 1. */
export function PartnersRowsPerPage({ query }: PartnersRowsPerPageProps) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      <span id="partners-rows-label" className="text-xs text-muted-foreground">
        Rows per page
      </span>
      <Select
        value={String(query.page_size)}
        items={ITEMS}
        onValueChange={(value) => {
          const size = Number(value);
          if (!PARTNERS_PAGE_SIZE_OPTIONS.some((option) => option === size)) return;
          router.push(
            buildPartnersHref(query, {
              page_size: size as PartnersQuery["page_size"],
              page: 1,
            }),
          );
        }}
      >
        <SelectTrigger
          aria-labelledby="partners-rows-label"
          className="h-11 w-20 data-[size=default]:h-11"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ITEMS.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
