import { describe, expect, it } from "vitest";

import { INVALID_PHOTO_MESSAGE, stripPhotoMetadata } from "@/lib/field/strip-photo-metadata";

const bytes = (...values: number[]) => new Uint8Array(values);
const text = (value: string) => Array.from(value, (char) => char.charCodeAt(0));

/** A JPEG segment: marker, length (which counts its own two bytes), payload. */
const jpegSegment = (marker: number, payload: number[]) => [0xff, marker, (payload.length + 2) >> 8, (payload.length + 2) & 0xff, ...payload];
const JPEG_START = [0xff, 0xd8];
const JPEG_IMAGE = [0xff, 0xda, 0x00, 0x03, 0x00, 0x12, 0x34, 0xff, 0xd9];

/** A PNG chunk: length, name, data, and a placeholder checksum (the code never checks it). */
const pngChunk = (name: string, data: number[]) => [0, 0, 0, data.length, ...text(name), ...data, 0, 0, 0, 0];
const PNG_START = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

describe("stripPhotoMetadata", () => {
  it("should cut the Exif and IPTC segments of a JPEG and keep the rest", () => {
    const keep = jpegSegment(0xe0, text("JFIF"));
    const input = bytes(...JPEG_START, ...keep, ...jpegSegment(0xe1, text("Exif GPS")), ...jpegSegment(0xed, text("IPTC")), ...JPEG_IMAGE);

    expect(stripPhotoMetadata(input)).toEqual(bytes(...JPEG_START, ...keep, ...JPEG_IMAGE));
  });

  it("should cut the Exif and text chunks of a PNG and keep the rest", () => {
    const input = bytes(
      ...PNG_START,
      ...pngChunk("IHDR", [1, 2, 3]),
      ...pngChunk("eXIf", text("GPS")),
      ...pngChunk("tEXt", text("note")),
      ...pngChunk("IDAT", [4, 5]),
      ...pngChunk("IEND", []),
    );

    expect(stripPhotoMetadata(input)).toEqual(
      bytes(...PNG_START, ...pngChunk("IHDR", [1, 2, 3]), ...pngChunk("IDAT", [4, 5]), ...pngChunk("IEND", [])),
    );
  });

  it("should leave a JPEG without metadata unchanged", () => {
    const input = bytes(...JPEG_START, ...jpegSegment(0xe0, text("JFIF")), ...JPEG_IMAGE);

    expect(stripPhotoMetadata(input)).toEqual(input);
  });

  it.each([
    ["text that is not an image", bytes(...text("hello world, not a photo"))],
    ["a JPEG cut short in a segment", bytes(...JPEG_START, 0xff, 0xe1, 0x00, 0x40, 0x01)],
    ["a PNG cut short in a chunk", bytes(...PNG_START, 0, 0, 0, 50, ...text("IDAT"), 1)],
  ])("should refuse %s", (_name, input) => {
    expect(() => stripPhotoMetadata(input)).toThrow(INVALID_PHOTO_MESSAGE);
  });
});
