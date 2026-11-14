import Link from "next/link";
import { LockIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { PhotoViewerHeader } from "@/features/bookings/components/photo-viewer-header";
import { cn } from "@/lib/utils";

interface PhotoViewerDeniedProps {
  links: readonly { label: string; href: string }[];
  /** Where the Back button goes. */
  backHref: string;
}

/** The Photo viewer when the user may not see these photos: it says so and shows nothing else. */
export function PhotoViewerDenied({ links, backHref }: PhotoViewerDeniedProps) {
  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <PhotoViewerHeader links={links} subtitle="Photo access" />
      <section
        role="alert"
        className="flex min-h-96 flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-border bg-surface p-8 text-center"
      >
        <LockIcon className="size-12 text-text-muted" strokeWidth={1.25} aria-hidden="true" />
        <h2 className="text-sm font-semibold text-foreground">You do not have access to these photos</h2>
        <p className="text-sm text-text-muted">Contact your administrator if you need access.</p>
        <Link href={backHref} className={cn(buttonVariants({ variant: "outline" }), "mt-2 min-h-11 bg-surface px-8")}>
          Back
        </Link>
      </section>
    </div>
  );
}
