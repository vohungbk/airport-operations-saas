"use client";

import { useRef } from "react";
import { XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useChainStepPhotos } from "@/features/return-queue/hooks/use-chain-step-photos";
import type { RecordedChainStep } from "@/features/return-queue/lib/return-chain";
import { PHOTO_ACCEPTED_TYPES } from "@/lib/field/photo-upload";

const STATUS_LABEL = {
  uploading: "Uploading",
  uploaded: "Uploaded",
  failed: "Upload failed. Remove it and try again.",
} as const;

interface ChainStepPhotoFieldProps {
  bookingId: string;
  step: RecordedChainStep;
  /** `SEAT-0001 · DXB · 04 Nov 2026`. */
  stamp: string;
  disabled: boolean;
  error?: string;
  onPathsChange: (paths: string[]) => void;
}

/** The Photo evidence box of the design: open the camera or choose files. */
export function ChainStepPhotoField({
  bookingId,
  step,
  stamp,
  disabled,
  error,
  onPathsChange,
}: ChainStepPhotoFieldProps) {
  const { photos, errors, addFiles, remove } = useChainStepPhotos(
    bookingId,
    step,
    onPathsChange,
  );
  const cameraInput = useRef<HTMLInputElement>(null);
  const filesInput = useRef<HTMLInputElement>(null);
  const accept = PHOTO_ACCEPTED_TYPES.join(",");

  return (
    <section aria-labelledby="chain-step-photos-title" className="flex flex-col gap-3">
      <h3 id="chain-step-photos-title" className="text-sm font-semibold text-foreground">
        Photo evidence *
      </h3>
      <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border-input p-4">
        <p className="text-sm font-semibold">Add inspection photos</p>
        <p className="text-xs text-text-muted">{stamp}</p>
        <p className="text-xs text-text-muted">
          Choose JPG or PNG files, or take a photo. Maximum 10 MB per photo.
        </p>
        <div className="flex flex-col gap-2 sm:max-w-44">
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={() => cameraInput.current?.click()}
            className="min-h-11 rounded-lg bg-surface px-4"
          >
            Open camera
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={() => filesInput.current?.click()}
            className="min-h-11 rounded-lg bg-surface px-4"
          >
            Choose files
          </Button>
        </div>
        <input
          ref={cameraInput}
          type="file"
          accept={accept}
          capture="environment"
          hidden
          aria-label="Take a photo"
          onChange={(event) => {
            addFiles(event.target.files);
            event.target.value = "";
          }}
        />
        <input
          ref={filesInput}
          type="file"
          accept={accept}
          multiple
          hidden
          aria-label="Choose photo files"
          onChange={(event) => {
            addFiles(event.target.files);
            event.target.value = "";
          }}
        />
        {photos.length > 0 && (
          <ul className="flex flex-col gap-2">
            {photos.map((photo) => (
              <li
                key={photo.id}
                data-status={photo.status}
                className="flex min-h-11 items-center gap-3 rounded-lg border border-border bg-surface px-3"
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm" title={photo.file_name}>
                    {photo.file_name}
                  </span>
                  <span
                    className={
                      photo.status === "failed"
                        ? "text-xs text-danger-fg"
                        : "text-xs text-text-muted"
                    }
                  >
                    {STATUS_LABEL[photo.status]}
                  </span>
                </div>
                {photo.status !== "uploading" && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={disabled}
                    aria-label={`Remove ${photo.file_name}`}
                    onClick={() => remove(photo.id)}
                  >
                    <XIcon aria-hidden="true" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      {[...errors, ...(error ? [error] : [])].map((message) => (
        <p key={message} role="alert" className="text-sm text-danger-fg">
          {message}
        </p>
      ))}
      <p className="text-xs text-text-muted">
        Photo required for each step. JPG or PNG · Up to 10 MB
      </p>
    </section>
  );
}
