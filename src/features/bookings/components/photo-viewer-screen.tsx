"use client";

import { useRouter } from "next/navigation";
import { ImageIcon, LockIcon, TriangleAlertIcon } from "lucide-react";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { BookingPhotoCard } from "@/features/bookings/components/booking-photo-card";
import { PhotoViewerHeader } from "@/features/bookings/components/photo-viewer-header";
import { usePhotoViewer } from "@/features/bookings/hooks/use-photo-viewer";
import { BOOKING_PHOTO_TYPE_LABEL, photoCountLabel, type BookingPhoto } from "@/features/bookings/lib/booking-photos";
import { formatBookingDateTime } from "@/features/bookings/lib/booking-time";

interface PhotoViewerScreenProps {
  photos: readonly BookingPhoto[];
  /** The photos could not be read: the screen shows its error state with Retry. */
  failed: boolean;
  timeZone: string;
  links: readonly { label: string; href: string }[];
  /** `Inspection record · SEAT-0001 · Noi Bai (HAN)`. */
  subtitle: string;
  /** What the photos belong to, in the empty text and under the open photo: `record`, `seat`. */
  scope: "record" | "seat";
  /** The line under the open photo: `SEAT-0001 · Inspection record`. */
  contextLabel: string;
}

/**
 * The Photo viewer (FO-F06-S05): the photos of a record or of a seat history as a grid, and the photo that is
 * open beside it. The photos are private: each one opens through a fresh short-lived signed link.
 */
export function PhotoViewerScreen({ photos, failed, timeZone, links, subtitle, scope, contextLabel }: PhotoViewerScreenProps) {
  const router = useRouter();
  const viewer = usePhotoViewer(photos);
  const formatTime = (iso: string) => formatBookingDateTime(iso, timeZone);
  const { selected } = viewer;

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <PhotoViewerHeader links={links} subtitle={subtitle} note={failed ? undefined : photoCountLabel(photos.length)} />

      {failed && (
        <Alert variant="destructive" className="items-start">
          <TriangleAlertIcon aria-hidden="true" />
          <AlertTitle>Could not load photos</AlertTitle>
          <p className="text-sm">Check your connection and try again.</p>
          <Button type="button" variant="outline" className="mt-2 min-h-11 bg-surface px-4" onClick={() => router.refresh()}>
            Retry
          </Button>
        </Alert>
      )}

      {failed ? (
        <section className="flex min-h-64 flex-col gap-2 rounded-xl border border-border bg-surface p-6">
          <h2 className="text-sm font-semibold text-foreground">Photo list unavailable</h2>
          <p className="text-sm text-text-muted">{`Retry to load the photos for this ${scope}.`}</p>
        </section>
      ) : photos.length === 0 ? (
        <section
          data-slot="photos-empty"
          className="flex min-h-96 flex-col items-center justify-center gap-3 rounded-xl border border-border bg-surface p-8 text-center"
        >
          <ImageIcon className="size-12 text-text-muted" strokeWidth={1.25} aria-hidden="true" />
          <h2 className="text-sm font-semibold text-foreground">No photos yet</h2>
          <p className="text-sm text-text-muted">{`Photos added to this ${scope} will appear here.`}</p>
        </section>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[1fr_minmax(0,24rem)]">
          <ul className="grid grid-cols-2 gap-4 xl:grid-cols-3">
            {photos.map((photo) => (
              <BookingPhotoCard
                key={photo.id}
                photo={photo}
                formatTime={formatTime}
                selected={photo.id === selected?.id}
                onOpen={() => viewer.select(photo.id)}
              />
            ))}
          </ul>

          {selected && (
            <section aria-label="Photo preview" className="flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-medium text-foreground">{`Photo ${viewer.position} of ${photos.length}`}</h2>
                <Button type="button" variant="outline" className="min-h-11 bg-surface px-4" onClick={viewer.close}>
                  Close
                </Button>
              </div>

              {viewer.link.failed ? (
                <div role="alert" className="flex flex-col items-center gap-3 py-8 text-center">
                  <LockIcon className="size-8 text-text-muted" strokeWidth={1.25} aria-hidden="true" />
                  <p className="text-sm font-semibold text-foreground">This photo link has expired</p>
                  <p className="text-sm text-text-muted">Open the photo again to request a new secure link.</p>
                  <Button type="button" variant="outline" className="min-h-11 bg-surface px-6" onClick={viewer.openAgain}>
                    Open again
                  </Button>
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- a private signed address of any size
                <img
                  src={viewer.link.url ?? selected.url}
                  alt={selected.caption ?? "Photo"}
                  className="max-h-96 w-full rounded-lg border border-border object-contain"
                />
              )}

              <div className="flex min-w-0 flex-col gap-2">
                <p className="text-sm font-semibold break-words text-foreground">{selected.caption ?? "Untitled photo"}</p>
                <p className="text-sm text-primary">{BOOKING_PHOTO_TYPE_LABEL[selected.type]}</p>
              </div>
              <div className="flex min-w-0 flex-col gap-1 text-xs text-text-muted">
                {selected.uploader_name && <p className="text-sm text-foreground">{`Added by ${selected.uploader_name}`}</p>}
                {selected.taken_at && <p className="tabular-nums">{formatTime(selected.taken_at)}</p>}
                <p>{contextLabel}</p>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
