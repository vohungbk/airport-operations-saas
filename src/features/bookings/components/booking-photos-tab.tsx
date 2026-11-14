"use client";

import { useRef, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon, DownloadIcon } from "lucide-react";

import { PhotoUploader } from "@/components/domain/photo-uploader";
import { PhotoViewer } from "@/components/domain/photo-viewer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useBookingPhotoUpload } from "@/features/bookings/hooks/use-booking-photo-upload";
import { useSendBookingPhoto } from "@/features/bookings/hooks/use-send-booking-photo";
import {
  BOOKING_PHOTO_DROP_HINT,
  BOOKING_PHOTO_FILTERS,
  BOOKING_PHOTO_RULE_HINT,
  BOOKING_PHOTO_TYPE_LABEL,
  filterBookingPhotos,
  stepPhotoIndex,
  type BookingPhoto,
  type BookingPhotoFilter,
} from "@/features/bookings/lib/booking-photos";
import { formatBookingDateTime } from "@/features/bookings/lib/booking-time";
import { PHOTO_ACCEPTED_TYPES } from "@/lib/field/photo-upload";
import { cn } from "@/lib/utils";

interface BookingPhotosTabProps {
  bookingId: string;
  photos: BookingPhoto[];
  timeZone: string;
  /** The booking number in the line under the upload area: `Evidence for BK-2026-000123`. */
  bookingNumber: string;
  /** Admin, Operations Manager or the assigned technician; a Partner User reads only. */
  canUpload: boolean;
  /** The photos could not be read. */
  loadFailed?: boolean;
}

/**
 * The Photos tab of the booking page (UI-F06-T06): filter chips, a grid of the photos with their caption, type,
 * uploader and time, a viewer, and the upload area for the roles that may add photos.
 */
export function BookingPhotosTab({
  bookingId,
  photos,
  timeZone,
  bookingNumber,
  canUpload,
  loadFailed = false,
}: BookingPhotosTabProps) {
  const [filter, setFilter] = useState<BookingPhotoFilter>("all");
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const upload = useBookingPhotoUpload(useSendBookingPhoto(bookingId, "installation"));
  const fileInput = useRef<HTMLInputElement>(null);

  const visible = filterBookingPhotos(photos, filter);
  const open = openIndex === null ? null : (visible[openIndex] ?? null);
  const formatTime = (iso: string) => formatBookingDateTime(iso, timeZone);

  function handleInput(event: React.ChangeEvent<HTMLInputElement>) {
    if (event.target.files) upload.addFiles(event.target.files);
    event.target.value = "";
  }

  return (
    <section data-slot="booking-photos-tab" aria-label="Booking photos" className="flex flex-col gap-4">
      <div role="group" aria-label="Filter photos" className="flex gap-2 overflow-x-auto py-1">
        {BOOKING_PHOTO_FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            aria-pressed={filter === item.value}
            onClick={() => setFilter(item.value)}
            className={cn(
              "min-h-11 shrink-0 rounded-lg border px-5 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              filter === item.value
                ? "border-primary bg-primary font-semibold text-primary-foreground"
                : "border-border bg-card text-foreground hover:bg-muted",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loadFailed ? (
        <p role="alert" className="rounded-lg border border-border bg-card p-4 text-sm text-danger-fg">
          The photos could not be loaded. Try again.
        </p>
      ) : visible.length === 0 ? (
        <p data-slot="photos-empty" className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
          {photos.length === 0 ? "No photos for this booking yet." : "No photos of this type."}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {visible.map((photo, index) => (
            <li key={photo.id} className="min-w-0 overflow-hidden rounded-lg border border-border bg-card">
              <button
                type="button"
                onClick={() => setOpenIndex(index)}
                aria-label={`Open ${photo.caption ?? "photo"}`}
                className="block min-h-11 w-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- a private signed address of any size */}
                <img src={photo.url} alt={photo.caption ?? "Booking photo"} loading="lazy" className="aspect-video w-full bg-muted object-cover" />
              </button>
              <div className="flex min-w-0 flex-col gap-2 p-3">
                <p className="text-xs font-semibold break-words text-foreground">{photo.caption ?? "Untitled photo"}</p>
                <Badge variant="secondary" className="h-[27px] w-fit pointer-coarse:h-[27px]">
                  {BOOKING_PHOTO_TYPE_LABEL[photo.type]}
                </Badge>
                {photo.uploader_name && <p className="text-xs text-muted-foreground">{photo.uploader_name}</p>}
                {photo.taken_at && <p className="text-xs tabular-nums text-muted-foreground">{formatTime(photo.taken_at)}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}

      {canUpload && (
        <div
          role="presentation"
          className="flex flex-col gap-2"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            upload.addFiles(event.dataTransfer.files);
          }}
        >
          <PhotoUploader
            items={upload.items}
            title="Drop photos to upload"
            description={BOOKING_PHOTO_DROP_HINT}
            rule_hint=""
            choose_label="Choose photos"
            box_className="bg-primary-subtle"
            on_choose_files={() => fileInput.current?.click()}
            on_retry={upload.retry}
            on_remove={upload.remove}
          />
          <input
            ref={fileInput}
            aria-label="Choose photos"
            type="file"
            accept={PHOTO_ACCEPTED_TYPES.join(",")}
            multiple
            hidden
            onChange={handleInput}
          />
          <p className="text-sm text-muted-foreground">
            {BOOKING_PHOTO_RULE_HINT} · Evidence for {bookingNumber}
          </p>
          {upload.errors.length > 0 && (
            <ul role="alert" className="flex flex-col gap-1 text-sm text-danger-fg">
              {upload.errors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Dialog open={open !== null} onOpenChange={(next) => !next && setOpenIndex(null)}>
        <DialogContent className="max-h-dvh overflow-y-auto max-sm:h-dvh max-sm:max-w-none max-sm:rounded-none sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{open?.caption ?? "Photo"}</DialogTitle>
            <DialogDescription>{open?.uploader_name ?? "Booking photo"}</DialogDescription>
          </DialogHeader>
          <PhotoViewer
            photo={open && { url: open.url, alt: open.caption ?? "Booking photo", caption: open.caption, taken_at: open.taken_at }}
            formatTime={formatTime}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => setOpenIndex((i) => stepPhotoIndex(i ?? 0, visible.length, -1))}
              >
                <ChevronLeftIcon data-icon="inline-start" aria-hidden="true" />
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => setOpenIndex((i) => stepPhotoIndex(i ?? 0, visible.length, 1))}
              >
                Next
                <ChevronRightIcon data-icon="inline-end" aria-hidden="true" />
              </Button>
            </div>
            {open && (
              <a href={open.url} download className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary">
                <DownloadIcon className="size-4" aria-hidden="true" />
                Download
              </a>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
