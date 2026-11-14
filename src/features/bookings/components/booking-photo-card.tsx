import { Badge } from "@/components/ui/badge";
import { BOOKING_PHOTO_TYPE_LABEL, type BookingPhoto } from "@/features/bookings/lib/booking-photos";
import { cn } from "@/lib/utils";

interface BookingPhotoCardProps {
  photo: BookingPhoto;
  formatTime: (iso: string) => string;
  onOpen: () => void;
  /** The photo shown in the preview; it gets the primary border. */
  selected?: boolean;
}

/** One photo of a booking: the picture that opens it, its caption, type, uploader and time. */
export function BookingPhotoCard({ photo, formatTime, onOpen, selected = false }: BookingPhotoCardProps) {
  return (
    <li
      aria-current={selected || undefined}
      className={cn("min-w-0 overflow-hidden rounded-lg border bg-card", selected ? "border-primary ring-1 ring-primary" : "border-border")}
    >
      <button
        type="button"
        onClick={onOpen}
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
  );
}
