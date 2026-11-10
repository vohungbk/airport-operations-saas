import { notFound } from "next/navigation";

import { requirePermission } from "@/lib/auth/current-user";
import { getSeatById } from "@/features/seats/lib/get-seat-by-id";
import { SeatQrPrint } from "@/features/seats/components/seat-qr-print";

interface SeatQrPrintPageProps {
  params: Promise<{ id: string }>;
}

export default async function SeatQrPrintPage({ params }: SeatQrPrintPageProps) {
  await requirePermission("seats:manage");

  const { id } = await params;
  const seat = await getSeatById(id);

  if (!seat) {
    notFound();
  }

  return (
    <SeatQrPrint
      seatId={seat.id}
      serialNumber={seat.serial_number}
      publicToken={seat.public_token}
    />
  );
}
