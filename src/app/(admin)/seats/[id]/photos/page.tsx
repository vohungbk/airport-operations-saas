import { notFound } from "next/navigation";

import { requirePermission } from "@/lib/auth/current-user";
import { PhotoViewerScreen } from "@/features/bookings/components/photo-viewer-screen";
import { getSeatPhotos } from "@/features/bookings/lib/get-seat-photos";
import { getSeatById } from "@/features/seats/lib/get-seat-by-id";

interface SeatPhotosPageProps {
  params: Promise<{ id: string }>;
}

/** The photos of every booking the seat has had (FO-F06-S05), opened from the seat history. */
export default async function SeatPhotosPage({ params }: SeatPhotosPageProps) {
  await requirePermission("seats:manage");

  const { id } = await params;
  const [seat, { photos, failed, time_zone }] = await Promise.all([getSeatById(id), getSeatPhotos(id)]);

  if (!seat) {
    notFound();
  }

  return (
    <PhotoViewerScreen
      photos={photos}
      failed={failed}
      timeZone={time_zone}
      links={[{ label: "← Back to seat history", href: `/seats/${seat.id}` }]}
      subtitle={["Seat history", seat.serial_number, seat.airport && `${seat.airport.name} (${seat.airport.code})`].filter(Boolean).join(" · ")}
      scope="seat"
      contextLabel={`${seat.serial_number} · Seat history`}
    />
  );
}
