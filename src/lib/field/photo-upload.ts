/**
 * Pure logic for the photo parts (UI-F04-S03, spec R5, E4). The parts only show what they are
 * given: choosing a file and sending it belong to the feature that uses them.
 */

export type PhotoUploadStatus = "uploading" | "uploaded" | "failed";

export interface PhotoUploadItem {
  id: string;
  file_name: string;
  status: PhotoUploadStatus;
  /** 0 to 100, read only while `uploading`. */
  progress?: number;
  /** Address of the stored photo, read only when `uploaded`. */
  thumbnail_url?: string;
}

export interface UploadSummary {
  uploading: number;
  uploaded: number;
  failed: number;
}

/** The bar never leaves 0 to 100; a value that is not a number counts as 0. */
export function clampProgress(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function summarizeUploads(items: readonly PhotoUploadItem[]): UploadSummary {
  const summary: UploadSummary = { uploading: 0, uploaded: 0, failed: 0 };
  for (const item of items) summary[item.status] += 1;
  return summary;
}
