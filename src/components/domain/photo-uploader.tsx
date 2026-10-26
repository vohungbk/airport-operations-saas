"use client"

import { CameraIcon, CircleAlertIcon, ImagePlusIcon, RotateCcwIcon, XIcon } from "lucide-react"

import { PhotoThumbnail } from "@/components/domain/photo-viewer"
import { Button } from "@/components/ui/button"
import { clampProgress, type PhotoUploadItem } from "@/lib/field/photo-upload"
import { cn } from "@/lib/utils"

interface PhotoUploaderProps {
  items: readonly PhotoUploadItem[]
  /** The camera view is open: the part offers Capture and Close instead of Take a photo. */
  camera_open?: boolean
  on_open_camera?: () => void
  on_capture?: () => void
  on_close_camera?: () => void
  on_choose_files?: () => void
  on_retry?: (id: string) => void
  on_remove?: (id: string) => void
  className?: string
}

/**
 * Shows every state of an upload (spec R5): empty, camera, uploading with progress, uploaded
 * thumbnails, failed with retry, and remove. It picks and sends nothing; the caller does, so this
 * part holds no native file input.
 */
function PhotoUploader({
  items,
  camera_open = false,
  on_open_camera,
  on_capture,
  on_close_camera,
  on_choose_files,
  on_retry,
  on_remove,
  className,
}: PhotoUploaderProps) {
  const empty = items.length === 0 && !camera_open
  const state = camera_open ? "camera" : empty ? "empty" : "filled"

  return (
    <div data-slot="photo-uploader" data-state={state} className={cn("flex min-w-0 flex-col gap-3", className)}>
      <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-dashed border-border p-4">
        {camera_open ? (
          <>
            <p className="text-sm font-medium">The camera is open.</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={on_capture}>
                <CameraIcon data-icon="inline-start" aria-hidden="true" />
                Capture
              </Button>
              <Button type="button" variant="outline" onClick={on_close_camera}>
                Close camera
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-sm font-medium">{empty ? "No photos yet. Take a photo or choose files" : "Take a photo or choose files"}</p>
              <p className="text-xs text-muted-foreground">JPG or PNG · Maximum 10 MB per photo</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={on_open_camera}>
                <CameraIcon data-icon="inline-start" aria-hidden="true" />
                Take photo
              </Button>
              <Button type="button" variant="outline" onClick={on_choose_files}>
                <ImagePlusIcon data-icon="inline-start" aria-hidden="true" />
                Choose files
              </Button>
            </div>
          </>
        )}
      </div>
      {items.length > 0 && (
        <ul className="flex min-w-0 flex-col gap-2">
          {items.map((item) => (
            <li key={item.id} data-status={item.status} className="flex min-w-0 items-center gap-3 rounded-lg border border-border p-2">
              {item.status === "uploaded" && item.thumbnail_url ? (
                <PhotoThumbnail url={item.thumbnail_url} alt={item.file_name} />
              ) : (
                <span aria-hidden="true" className="size-12 shrink-0 rounded-md bg-muted" />
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="min-w-0 truncate text-sm" title={item.file_name}>
                  {item.file_name}
                </span>
                <ItemStatus item={item} />
              </div>
              {item.status === "failed" && (
                <Button type="button" variant="outline" size="sm" aria-label={`Retry ${item.file_name}`} onClick={() => on_retry?.(item.id)}>
                  <RotateCcwIcon data-icon="inline-start" aria-hidden="true" />
                  Retry
                </Button>
              )}
              {item.status !== "uploading" && (
                <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${item.file_name}`} onClick={() => on_remove?.(item.id)}>
                  <XIcon aria-hidden="true" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ItemStatus({ item }: { item: PhotoUploadItem }) {
  if (item.status === "uploading") {
    const percent = clampProgress(item.progress)
    return (
      <>
        <div
          role="progressbar"
          aria-label={`Uploading ${item.file_name}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        >
          <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">Uploading · {percent}%</span>
      </>
    )
  }
  if (item.status === "failed") {
    return (
      <span className="flex items-center gap-1 text-xs text-danger-fg">
        <CircleAlertIcon className="size-3.5 shrink-0" aria-hidden="true" />
        Upload failed. Try again.
      </span>
    )
  }
  return <span className="text-xs text-muted-foreground">Uploaded</span>
}

export { PhotoUploader }
export type { PhotoUploaderProps }
