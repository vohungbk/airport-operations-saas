import { ImageOffIcon } from "lucide-react"

import { cn } from "@/lib/utils"

interface PhotoViewerPhoto {
  /** Address of the stored photo, given by the caller (a signed address of the right tenant). */
  url: string
  alt: string
  caption: string | null
  taken_at: string | null
}

interface PhotoViewerProps {
  photo: PhotoViewerPhoto | null
  /** Formats a time for the airport (its time zone); the viewer does not pick a zone itself. */
  formatTime: (iso: string) => string
  className?: string
}

interface PhotoThumbnailProps {
  url: string
  alt: string
  className?: string
}

/** A small, fixed-size picture for the uploader and the timeline. */
function PhotoThumbnail({ url, alt, className }: PhotoThumbnailProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- the address is a stored photo of any size, not a static asset
    <img
      data-slot="photo-thumbnail"
      src={url}
      alt={alt}
      loading="lazy"
      className={cn("size-12 shrink-0 rounded-md border border-border object-cover", className)}
    />
  )
}

/** One photo with its caption and time. With no photo it says so, instead of an empty frame. */
function PhotoViewer({ photo, formatTime, className }: PhotoViewerProps) {
  if (photo === null) {
    return (
      <div
        data-slot="photo-viewer-empty"
        className={cn("flex items-center gap-2 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground", className)}
      >
        <ImageOffIcon className="size-4 shrink-0" aria-hidden="true" />
        No photo to show.
      </div>
    )
  }

  return (
    <figure data-slot="photo-viewer" className={cn("flex min-w-0 flex-col gap-2", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- the address is a stored photo of any size, not a static asset */}
      <img src={photo.url} alt={photo.alt} className="max-h-96 w-full rounded-lg border border-border object-contain" />
      <figcaption className="flex min-w-0 flex-col gap-0.5 text-sm">
        {photo.caption && <span className="break-words text-foreground">{photo.caption}</span>}
        <span className="text-xs tabular-nums text-muted-foreground">
          {photo.taken_at ? formatTime(photo.taken_at) : "Time not recorded"}
        </span>
      </figcaption>
    </figure>
  )
}

export { PhotoThumbnail, PhotoViewer }
export type { PhotoThumbnailProps, PhotoViewerPhoto, PhotoViewerProps }
