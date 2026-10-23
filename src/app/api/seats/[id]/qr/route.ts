import { type NextRequest, NextResponse } from "next/server";

import { apiError } from "@/lib/api/response";
import { ConfigurationError } from "@/lib/config/env";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";
import { getAppUrl } from "@/lib/config/app-url";
import { getSeatById } from "@/features/seats/lib/get-seat-by-id";
import {
  renderSeatQrSvg,
  seatQrFileName,
  seatQrPayload,
} from "@/features/seats/lib/seat-qr";
import { seatIdSchema } from "@/features/seats/schemas/seat.schema";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * CO-F04-S12 (AC03): the QR image of one seat, as a download. The caller must be signed in and
 * hold `seats:manage`; RLS then decides whether the seat is theirs to read. An unknown seat and
 * one RLS hides give the same answer. The image holds the address and the public token only.
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("UNAUTHORIZED", "Sign in to download this QR code.");
  }
  if (!hasPermission(user.role, "seats:manage")) {
    return apiError("FORBIDDEN", "You cannot download this QR code.");
  }

  const { id } = await params;
  if (!seatIdSchema.safeParse(id).success) {
    return apiError("VALIDATION_ERROR", "The seat id is not valid.", [
      { field: "id", issue: "Invalid" },
    ]);
  }

  const seat = await getSeatById(id);
  if (!seat) {
    return apiError("NOT_FOUND", "Seat not found.");
  }

  let svg: string;
  try {
    svg = renderSeatQrSvg(seatQrPayload(getAppUrl(), seat.public_token));
  } catch (error) {
    if (!(error instanceof ConfigurationError)) throw error;
    return apiError("INTERNAL_ERROR", "The QR code is not available.");
  }

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${seatQrFileName(seat.serial_number)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
