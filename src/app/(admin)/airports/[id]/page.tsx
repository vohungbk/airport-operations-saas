import { notFound } from "next/navigation";

import { requirePermission } from "@/lib/auth/current-user";
import { getAirportById } from "@/features/airports/lib/get-airport-by-id";
import { getAirportRelatedCounts } from "@/features/airports/lib/get-airport-related-counts";
import { AirportDetail } from "@/features/airports/components/airport-detail";

interface AirportDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AirportDetailPage({
  params,
}: AirportDetailPageProps) {
  await requirePermission("airports:manage");

  const { id } = await params;
  const airport = await getAirportById(id);

  if (!airport) {
    notFound();
  }

  const relatedCounts = await getAirportRelatedCounts(airport.id);

  return <AirportDetail airport={airport} relatedCounts={relatedCounts} />;
}
