import { summarizeUploads, type PhotoUploadItem } from "@/lib/field/photo-upload";

/** What the step form shows about its photos (FO-F06-S06, spec R9). */
export const STEP_PHOTO_REQUIRED_HINT = "A photo is required before you can save this step.";

interface StepPhotoStatus {
  /** At least one photo is stored: the step may be saved. */
  hasPhoto: boolean;
  /** A photo is still being sent: wait before saving. */
  isUploading: boolean;
  /** The step can be sent to the server. */
  canSave: boolean;
}

/** Whether a step that needs a photo may be saved, from the state of its uploads. Pure. */
export function getStepPhotoStatus(items: readonly PhotoUploadItem[]): StepPhotoStatus {
  const { uploaded, uploading } = summarizeUploads(items);
  const hasPhoto = uploaded > 0;
  const isUploading = uploading > 0;

  return { hasPhoto, isUploading, canSave: hasPhoto && !isUploading };
}
