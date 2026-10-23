import { notFound, redirect } from "next/navigation";

import { requireAuth } from "@/lib/auth/current-user";
import { ScannedSeatCard } from "@/features/seats/components/scanned-seat-card";
import { getSeatByPublicToken } from "@/features/seats/lib/get-seat-by-token";
import { getSeatScanView } from "@/features/seats/lib/seat-scan-access";

interface SeatQrPageProps {
  params: Promise<{ token: string }>;
}

/**
 * CO-F04-S13: where the QR code of a seat leads. A scan only identifies the seat: this page
 * performs nothing. A signed-out visitor is sent to sign in by the proxy and returned here
 * (AC02, AC05); `requireAuth()` is the second, independent guard. RLS decides which seats the
 * user reaches (AC04), and a seat outside the scope looks the same as an unknown token. An
 * operations role is sent to the full seat page; others get a read-only card, with the status
 * of a quarantined or retired seat shown (AC06).
 */
export default async function SeatQrPage({ params }: SeatQrPageProps) {
  const user = await requireAuth();

  const { token } = await params;
  const seat = await getSeatByPublicToken(token);

  if (!seat) {
    notFound();
  }

  const view = getSeatScanView(user.role);

  if (view.openFullDetail) {
    redirect(`/seats/${seat.id}`);
  }

  return <ScannedSeatCard seat={seat} view={view} />;
}
