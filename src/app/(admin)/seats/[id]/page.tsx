import { notFound } from "next/navigation";

import { requirePermission } from "@/lib/auth/current-user";
import { getSeatById } from "@/features/seats/lib/get-seat-by-id";
import { getSeatStatusHistory } from "@/features/seats/lib/get-seat-status-history";
import { SeatDetail } from "@/features/seats/components/seat-detail";
import { getReturnChainBookingIdForSeat } from "@/features/return-queue/lib/get-return-queue";

interface SeatDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function SeatDetailPage({ params }: SeatDetailPageProps) {
  await requirePermission("seats:manage");

  const { id } = await params;
  // History and the chain booking only need the route id, so the queries run in parallel.
  const [seat, history, chainBookingId] = await Promise.all([
    getSeatById(id),
    getSeatStatusHistory(id),
    getReturnChainBookingIdForSeat(id),
  ]);

  if (!seat) {
    notFound();
  }

  return <SeatDetail seat={seat} history={history} chainBookingId={chainBookingId} />;
}
