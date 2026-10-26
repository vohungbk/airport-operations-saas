import { describe, expect, it } from "vitest";

import { clampProgress, summarizeUploads, type PhotoUploadItem } from "@/lib/field/photo-upload";

describe("clampProgress", () => {
  it("should keep a value inside 0 to 100", () => {
    expect(clampProgress(68)).toBe(68);
  });

  it.each([
    [150, 100],
    [-5, 0],
    [67.6, 68],
  ])("should turn %s into %s", (input, expected) => {
    expect(clampProgress(input)).toBe(expected);
  });

  it("should count a missing or non-numeric value as 0", () => {
    expect(clampProgress(undefined)).toBe(0);
    expect(clampProgress(Number.NaN)).toBe(0);
  });
});

describe("summarizeUploads", () => {
  const item = (id: string, status: PhotoUploadItem["status"]): PhotoUploadItem => ({ id, file_name: `${id}.jpg`, status });

  it("should count each status", () => {
    const summary = summarizeUploads([item("a", "uploaded"), item("b", "failed"), item("c", "uploading"), item("d", "uploaded")]);
    expect(summary).toEqual({ uploading: 1, uploaded: 2, failed: 1 });
  });

  it("should return zeros for an empty list", () => {
    expect(summarizeUploads([])).toEqual({ uploading: 0, uploaded: 0, failed: 0 });
  });
});
