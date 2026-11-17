import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/** The "Back to Partners" link above the title of every state of the partner detail. */
export function PartnerDetailBackLink() {
  return (
    <Link
      href="/partners"
      className="inline-flex min-h-11 w-fit items-center gap-1.5 text-xs font-medium text-primary hover:underline"
    >
      <ArrowLeft className="size-3.5" aria-hidden="true" />
      Back to Partners
    </Link>
  );
}
