import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

/** The title, the one-line description and the Create partner button of the Partners list. */
export function PartnersPageHeader() {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Partners
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage your rental network and partner contacts.
        </p>
      </div>
      <Link
        href="/partners/new"
        className={buttonVariants({ className: "min-h-11 self-start px-4" })}
      >
        Create partner
      </Link>
    </div>
  );
}
