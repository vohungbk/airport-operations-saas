import { Skeleton } from "@/components/ui/skeleton";

/** The loading state of the invoice list: the heading, the filters and the rows of the table. */
export default function InvoicesLoading() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-8" role="status" aria-busy="true" aria-label="Loading">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-24 w-72" />
        <Skeleton className="h-24 w-44" />
        <Skeleton className="h-24 w-72" />
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
