import { PhotoViewerHeader } from "@/features/bookings/components/photo-viewer-header";
import { Skeleton } from "@/components/ui/skeleton";

const PLACEHOLDER_CARDS = ["a", "b", "c", "d", "e", "f"] as const;

/** One grey card: the picture and three lines. */
function SkeletonCard({ className }: { className: string }) {
  return (
    <div className={className}>
      <Skeleton className="aspect-video w-full" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}

/** The Photo viewer while the photos load: six cards and the preview, as grey blocks. */
export function PhotoViewerLoading() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-8" role="status" aria-busy="true" aria-label="Loading">
      <PhotoViewerHeader note="Loading photos..." />
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_minmax(0,24rem)]">
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
          {PLACEHOLDER_CARDS.map((key) => (
            <SkeletonCard key={key} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3" />
          ))}
        </div>
        <SkeletonCard className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4" />
      </div>
    </div>
  );
}
