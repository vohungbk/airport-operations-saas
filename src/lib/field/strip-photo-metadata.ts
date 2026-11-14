/**
 * Removes location data from a photo before it leaves the browser (FO-F06-S02, spec R10). The image is not
 * encoded again: the pixels stay as they are and only the metadata blocks are cut, so the file never grows.
 * JPEG: the APP1 (Exif and XMP) and APP13 (IPTC) segments. PNG: the eXIf and text chunks. Pure logic.
 */

export const INVALID_PHOTO_MESSAGE = "The photo could not be read. Choose another file.";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PNG_METADATA_CHUNKS = new Set(["eXIf", "tEXt", "iTXt", "zTXt"]);
const JPEG_METADATA_MARKERS = new Set([0xe1, 0xed]);

const isJpeg = (bytes: Uint8Array) => bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8;
const isPng = (bytes: Uint8Array) => bytes.length > 8 && PNG_SIGNATURE.every((value, index) => bytes[index] === value);

function join(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function stripJpeg(bytes: Uint8Array): Uint8Array {
  const kept: Uint8Array[] = [bytes.subarray(0, 2)];
  let offset = 2;

  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) throw new Error(INVALID_PHOTO_MESSAGE);
    const marker = bytes[offset + 1];
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    // Start of scan: the image data follows, up to the end of the file.
    if (marker === 0xda) {
      kept.push(bytes.subarray(offset));
      return join(kept);
    }
    if (marker === 0xd9) {
      kept.push(bytes.subarray(offset, offset + 2));
      return join(kept);
    }
    if (offset + 4 > bytes.length) throw new Error(INVALID_PHOTO_MESSAGE);
    const end = offset + 2 + ((bytes[offset + 2] << 8) | bytes[offset + 3]);
    if (end > bytes.length) throw new Error(INVALID_PHOTO_MESSAGE);
    if (!JPEG_METADATA_MARKERS.has(marker)) kept.push(bytes.subarray(offset, end));
    offset = end;
  }

  throw new Error(INVALID_PHOTO_MESSAGE);
}

function stripPng(bytes: Uint8Array): Uint8Array {
  const kept: Uint8Array[] = [bytes.subarray(0, 8)];
  let offset = 8;

  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) throw new Error(INVALID_PHOTO_MESSAGE);
    const length = ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
    const end = offset + 12 + length;
    if (end > bytes.length) throw new Error(INVALID_PHOTO_MESSAGE);
    const name = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    if (!PNG_METADATA_CHUNKS.has(name)) kept.push(bytes.subarray(offset, end));
    offset = end;
  }

  return join(kept);
}

/** The photo without its metadata. Throws `INVALID_PHOTO_MESSAGE` when the bytes are neither a JPEG nor a PNG. */
export function stripPhotoMetadata(bytes: Uint8Array): Uint8Array {
  if (isJpeg(bytes)) return stripJpeg(bytes);
  if (isPng(bytes)) return stripPng(bytes);
  throw new Error(INVALID_PHOTO_MESSAGE);
}

/** The same file with its metadata removed, with the same name and type. */
export async function stripPhotoFileMetadata(file: File): Promise<File> {
  const cleaned = stripPhotoMetadata(new Uint8Array(await file.arrayBuffer()));
  return new File([cleaned.slice()], file.name, { type: file.type, lastModified: file.lastModified });
}
