import { Skeleton } from "@/components/ui/skeleton";

const SKELETON_COLUMNS = 5;

export default function WorkflowBoardLoading() {
  return (
    <div className="flex flex-1 flex-col" role="status" aria-busy="true" aria-label="Loading">
      <div className="flex flex-col gap-4 p-8 pb-6">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-11 w-full max-w-3xl" />
      </div>
      <div className="flex flex-1 gap-6 overflow-hidden bg-muted/40 p-6">
        {Array.from({ length: SKELETON_COLUMNS }, (_, index) => (
          <Skeleton key={index} className="h-72 w-72 shrink-0 bg-card" />
        ))}
      </div>
    </div>
  );
}
