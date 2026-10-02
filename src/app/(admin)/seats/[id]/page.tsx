import { notFound } from "next/navigation";

import { requirePermission } from "@/lib/auth/current-user";
import { getSeatById } from "@/features/seats/lib/get-seat-by-id";
import { getSeatStatusHistory } from "@/features/seats/lib/get-seat-status-history";
import { SeatDetail } from "@/features/seats/components/seat-detail";

interface SeatDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function SeatDetailPage({ params }: SeatDetailPageProps) {
  await requirePermission("seats:manage");

  const { id } = await params;
  // History only needs the route id, so both queries run in parallel.
  const [seat, history] = await Promise.all([
    getSeatById(id),
    getSeatStatusHistory(id),
  ]);

  if (!seat) {
    notFound();
  }

  return <SeatDetail seat={seat} history={history} />;
}
