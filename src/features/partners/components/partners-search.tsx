"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildPartnersHref } from "@/features/partners/lib/build-partners-href";
import type { PartnersQuery } from "@/features/partners/schemas/partners-query.schema";

interface PartnersSearchProps {
  /** The query the list was read with; `null` where there is no list yet (loading, error). */
  query: PartnersQuery | null;
}

/**
 * The one Client Component of the list: the Search partners box. Enter sends the search to the address
 * and back to page 1; the table, the footer and the states render from the address on the server.
 */
export function PartnersSearch({ query }: PartnersSearchProps) {
  const router = useRouter();
  const [value, setValue] = useState(query?.q ?? "");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const q = value.trim() || undefined;
    router.push(
      query
        ? buildPartnersHref(query, { q, page: 1 })
        : q
          ? `/partners?q=${encodeURIComponent(q)}`
          : "/partners",
    );
  }

  return (
    <form
      role="search"
      onSubmit={handleSubmit}
      className="flex flex-col gap-2"
    >
      <Label
        htmlFor="partners-search"
        className="text-sm font-semibold text-foreground"
      >
        Search partners
      </Label>
      <Input
        id="partners-search"
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search by code, name or contact"
        className="h-11 rounded-lg border-border-input bg-surface px-3 text-sm"
      />
    </form>
  );
}
