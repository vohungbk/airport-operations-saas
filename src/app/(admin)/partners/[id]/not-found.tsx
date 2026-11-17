import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { PartnerDetailBackLink } from "@/features/partners/components/partner-detail-back-link";

/** Shown inside the shell when the partner does not exist or the link is wrong. */
export default function PartnerDetailNotFound() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 sm:p-8">
      <PartnerDetailBackLink />
      <div className="flex min-h-64 flex-col items-center justify-center gap-2 rounded-xl border bg-card px-6 py-12 text-center">
        <p className="text-xs font-medium text-primary">404</p>
        <h1 className="text-lg font-semibold text-foreground">Partner not found</h1>
        <p className="max-w-md text-xs text-muted-foreground">
          This partner may have been removed or the link is incorrect.
        </p>
        <Link
          href="/partners"
          className={buttonVariants({ className: "mt-2 min-h-11 px-4" })}
        >
          Back to Partners
        </Link>
      </div>
    </div>
  );
}
