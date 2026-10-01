import { notFound } from "next/navigation";

import { requirePermission } from "@/lib/auth/current-user";
import { getSeatCategoryById } from "@/features/seat-categories/lib/get-seat-category-by-id";
import { getSeatCategoryRelatedCounts } from "@/features/seat-categories/lib/get-seat-category-related-counts";
import { SeatCategoryDetail } from "@/features/seat-categories/components/seat-category-detail";

interface SeatCategoryDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function SeatCategoryDetailPage({
  params,
}: SeatCategoryDetailPageProps) {
  await requirePermission("seat_categories:manage");

  const { id } = await params;
  // The count only needs the route id, so both queries run in parallel.
  const [seatCategory, relatedCounts] = await Promise.all([
    getSeatCategoryById(id),
    getSeatCategoryRelatedCounts(id),
  ]);

  if (!seatCategory) {
    notFound();
  }

  return (
    <SeatCategoryDetail
      seatCategory={seatCategory}
      relatedCounts={relatedCounts}
    />
  );
}
