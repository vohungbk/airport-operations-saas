import { Skeleton } from "@/components/ui/skeleton";
import { PartnerDetailBackLink } from "@/features/partners/components/partner-detail-back-link";

const FIELD_ROWS = Array.from({ length: 7 }, (_, index) => index);

export default function PartnerDetailLoading() {
  return (
    <div
      className="flex flex-1 flex-col gap-4 p-4 sm:p-8"
      role="status"
      aria-busy="true"
      aria-label="Loading partner"
    >
      <PartnerDetailBackLink />
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Loading partner...
      </h1>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">Partner information</h2>
          <div className="mt-5 flex flex-col gap-5">
            {FIELD_ROWS.map((row) => (
              <div key={row} className="flex flex-col gap-2">
                <Skeleton className="h-2.5 w-16" />
                <Skeleton className="h-3.5 w-full max-w-72" />
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">Record info</h2>
          <div className="mt-5 flex flex-col gap-5">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-full" />
          </div>
        </section>
      </div>
    </div>
  );
}
