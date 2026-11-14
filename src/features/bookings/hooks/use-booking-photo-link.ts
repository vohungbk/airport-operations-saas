"use client";

import { useEffect, useState } from "react";

import { getBookingPhotoLinkAction } from "@/features/bookings/actions/get-booking-photo-link.action";
import { BOOKING_PHOTO_LINK_ERROR } from "@/features/bookings/lib/booking-photo-errors";
import { runClientAction } from "@/lib/actions/run-client-action";

export interface BookingPhotoLink {
  /** The link to show: a fresh one once it arrives, the link of the page until then. */
  url: string | null;
  /** A fresh link could not be requested. */
  failed: boolean;
}

/**
 * Every time a photo is opened, asks for a new signed link (FO-F06-S04, E6), so a link that expired while the
 * page stayed open is never used. Opening the same photo again asks again.
 */
export function useBookingPhotoLink(photo: { id: string; url: string } | null): BookingPhotoLink {
  const [fresh, setFresh] = useState<{ id: string; url: string } | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);
  const photoId = photo?.id ?? null;

  useEffect(() => {
    if (photoId === null) return;

    let cancelled = false;

    void runClientAction(() => getBookingPhotoLinkAction({ photo_id: photoId }), BOOKING_PHOTO_LINK_ERROR).then((result) => {
      if (cancelled) return;
      if (result.success) setFresh({ id: photoId, url: result.url });
      else setFailedId(photoId);
    });

    // Leaving the photo (closing it, or going to another) drops its link, so opening it again asks again.
    return () => {
      cancelled = true;
      setFresh(null);
      setFailedId(null);
    };
  }, [photoId]);

  if (photo === null) return { url: null, failed: false };

  return { url: fresh?.id === photo.id ? fresh.url : photo.url, failed: failedId === photo.id };
}
