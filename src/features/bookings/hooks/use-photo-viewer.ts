"use client";

import { useState } from "react";

import { useBookingPhotoLink, type BookingPhotoLink } from "@/features/bookings/hooks/use-booking-photo-link";
import type { BookingPhoto } from "@/features/bookings/lib/booking-photos";

export interface PhotoViewerState {
  /** The photo in the preview: the first one until the user picks another or closes the preview. */
  selected: BookingPhoto | null;
  /** `1` for the first photo; `0` when no photo is open. */
  position: number;
  link: BookingPhotoLink;
  select: (photoId: string) => void;
  close: () => void;
  /** Asks for a new signed link of the open photo (its link expired). */
  openAgain: () => void;
}

/** The selection and the signed link of the photo viewer (FO-F06-S05). Every open photo asks for a fresh link. */
export function usePhotoViewer(photos: readonly BookingPhoto[]): PhotoViewerState {
  // `undefined`: the user has not chosen yet, so the first photo is open. `null`: the user closed the preview.
  const [choice, setChoice] = useState<string | null | undefined>(undefined);
  const [attempt, setAttempt] = useState(0);

  const selectedId = choice === undefined ? (photos[0]?.id ?? null) : choice;
  const index = photos.findIndex((photo) => photo.id === selectedId);
  const selected = index === -1 ? null : photos[index];
  const link = useBookingPhotoLink(selected, attempt);

  return {
    selected,
    position: index + 1,
    link,
    select: setChoice,
    close: () => setChoice(null),
    openAgain: () => setAttempt((count) => count + 1),
  };
}
