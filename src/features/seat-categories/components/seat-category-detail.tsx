import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { SeatCategoryStatusBadge } from "@/features/seat-categories/components/seat-category-status-badge";
import { SetSeatCategoryActiveButton } from "@/features/seat-categories/components/set-seat-category-active-button";
import { formatAgeRange } from "@/features/seat-categories/lib/format-age-range";
import type { SeatCategoryRelatedCounts } from "@/features/seat-categories/lib/get-seat-category-related-counts";
import type { SeatCategory } from "@/features/seat-categories/types";

interface SeatCategoryDetailProps {
  seatCategory: SeatCategory;
  relatedCounts: SeatCategoryRelatedCounts;
}

export function SeatCategoryDetail({
  seatCategory,
  relatedCounts,
}: SeatCategoryDetailProps) {
  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {seatCategory.name}
          </h1>
          <div>
            <SeatCategoryStatusBadge isActive={seatCategory.is_active} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/seat-categories/${seatCategory.id}/edit`}
            className={buttonVariants({ variant: "outline" })}
          >
            Edit
          </Link>
          <SetSeatCategoryActiveButton
            seatCategoryId={seatCategory.id}
            seatCategoryName={seatCategory.name}
            isActive={seatCategory.is_active}
          />
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-4 rounded-lg border border-border p-4 sm:grid-cols-3">
        <div>
          <dt className="text-sm text-muted-foreground">Child age</dt>
          <dd className="mt-1 text-sm text-foreground">
            {formatAgeRange(
              seatCategory.min_child_age,
              seatCategory.max_child_age,
            )}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Safety standard</dt>
          <dd className="mt-1 text-sm text-foreground">
            {seatCategory.safety_standard}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Created</dt>
          <dd className="mt-1 text-sm text-foreground">
            {new Date(seatCategory.created_at).toLocaleDateString()}
          </dd>
        </div>
        <div className="sm:col-span-3">
          <dt className="text-sm text-muted-foreground">Description</dt>
          <dd className="mt-1 text-sm text-foreground">
            {seatCategory.description ?? "No description."}
          </dd>
        </div>
      </dl>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border p-4">
          <p className="text-sm font-medium text-foreground">Seats</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">
            {relatedCounts.seats}
          </p>
        </div>
      </div>
    </div>
  );
}
