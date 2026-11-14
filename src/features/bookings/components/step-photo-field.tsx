"use client";

import { useRef } from "react";

import { PhotoUploader } from "@/components/domain/photo-uploader";
import { STEP_PHOTO_REQUIRED_HINT, getStepPhotoStatus } from "@/features/bookings/lib/step-photo";
import { BOOKING_PHOTO_RULE_HINT } from "@/features/bookings/lib/booking-photos";
import type { PhotoUploadItem } from "@/lib/field/photo-upload";
import { PHOTO_ACCEPTED_TYPES } from "@/lib/field/photo-upload";

interface StepPhotoFieldProps {
  /** What the photos show, for example "installation". */
  subject: string;
  items: readonly PhotoUploadItem[];
  errors: readonly string[];
  addFiles: (files: FileList | File[]) => void;
  retry: (id: string) => void;
  remove: (id: string) => void;
  /** Photos cannot be added yet (the step has no booking chosen). */
  disabled?: boolean;
  /** Shown under the box while the step has no photo. */
  disabledHint?: string;
}

/**
 * The photo box of a step that needs a photo (FO-F06-S06). It shows what the upload hook gives it and
 * sends nothing itself.
 */
export function StepPhotoField({
  subject,
  items,
  errors,
  addFiles,
  retry,
  remove,
  disabled = false,
  disabledHint,
}: StepPhotoFieldProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const { hasPhoto } = getStepPhotoStatus(items);

  function handleInput(event: React.ChangeEvent<HTMLInputElement>) {
    if (event.target.files) addFiles(event.target.files);
    event.target.value = "";
  }

  return (
    <div data-slot="step-photo-field">
      <PhotoUploader
        items={items}
        title={`Add ${subject} photos`}
        rule_hint={BOOKING_PHOTO_RULE_HINT}
        choose_label="Choose photos"
        on_choose_files={disabled ? undefined : () => fileInput.current?.click()}
        on_retry={retry}
        on_remove={remove}
      />
      <input
        ref={fileInput}
        aria-label="Choose photos"
        type="file"
        accept={PHOTO_ACCEPTED_TYPES.join(",")}
        multiple
        hidden
        disabled={disabled}
        onChange={handleInput}
      />
      {errors.length > 0 && (
        <ul role="alert" className="mt-2 flex flex-col gap-1 text-sm text-danger-fg">
          {errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
      {!hasPhoto && (
        <p className="mt-2 text-xs text-text-muted">
          {disabled && disabledHint ? disabledHint : STEP_PHOTO_REQUIRED_HINT}
        </p>
      )}
    </div>
  );
}
