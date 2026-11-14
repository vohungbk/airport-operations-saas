import { describe, expect, it } from "vitest";

import { getStepPhotoStatus } from "@/features/bookings/lib/step-photo";
import type { PhotoUploadItem } from "@/lib/field/photo-upload";

const item = (status: PhotoUploadItem["status"]): PhotoUploadItem => ({ id: status, file_name: `${status}.jpg`, status });

describe("getStepPhotoStatus", () => {
  it("should not let the step be saved when there is no photo", () => {
    expect(getStepPhotoStatus([])).toEqual({ hasPhoto: false, isUploading: false, canSave: false });
  });

  it("should let the step be saved once a photo is stored", () => {
    expect(getStepPhotoStatus([item("uploaded")]).canSave).toBe(true);
  });

  it.each([
    ["a photo is still being sent", [item("uploaded"), item("uploading")]],
    ["the only photo failed", [item("failed")]],
  ])("should not let the step be saved when %s", (_name, items) => {
    expect(getStepPhotoStatus(items).canSave).toBe(false);
  });
});
