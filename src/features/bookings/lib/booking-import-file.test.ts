import { describe, expect, it } from "vitest";

import {
  BOOKING_IMPORT_MAX_FILE_BYTES,
  IMPORT_FILE_ERRORS,
  checkImportFileMeta,
  checkImportHeader,
  decodeCsvText,
} from "@/features/bookings/lib/booking-import-file";
import { buildBookingImportTemplateCsv } from "@/features/bookings/lib/booking-import-template";

const HEADER = buildBookingImportTemplateCsv().trim();
const encode = (text: string) => new TextEncoder().encode(text).buffer as ArrayBuffer;

describe("booking import file (CO-F07-S02)", () => {
  it.each([
    [{ name: "bookings.csv", size: 1024 }, null],
    [{ name: "bookings.csv", size: BOOKING_IMPORT_MAX_FILE_BYTES }, null],
    [{ name: "bookings.csv", size: BOOKING_IMPORT_MAX_FILE_BYTES + 1 }, "FILE_TOO_LARGE"],
    [{ name: "bookings.xlsx", size: 1024 }, "NOT_A_CSV"],
  ])("should answer %j with %s before any byte is read", (file, expected) => {
    expect(checkImportFileMeta(file)).toBe(expected);
  });

  it("should read UTF-8 text and drop a leading byte order mark", () => {
    expect(decodeCsvText(encode("﻿notes,vehicle"))).toBe("notes,vehicle");
  });

  it("should refuse text that is not UTF-8", () => {
    // The start of a UTF-16 file: its byte order mark is not valid UTF-8.
    expect(decodeCsvText(new Uint8Array([0xff, 0xfe, 0x41, 0x00]).buffer)).toBeNull();
  });

  it.each([
    ["the template header", HEADER, null],
    ["the header followed by rows", `${HEADER}\r\nEXT-1,2026-11-08 09:30`, null],
    ["a header with spaces around the names", HEADER.split(",").join(" , "), null],
    ["the columns in another order", HEADER.split(",").reverse().join(","), "WRONG_HEADER"],
    ["a missing column", HEADER.split(",").slice(1).join(","), "WRONG_HEADER"],
    ["an extra column", `${HEADER},extra`, "WRONG_HEADER"],
    ["an empty file", "", "WRONG_HEADER"],
    ["data without a header", "EXT-1,2026-11-08 09:30,x,y", "WRONG_HEADER"],
  ])("should answer %s with %s", (_label, text, expected) => {
    expect(checkImportHeader(text)).toBe(expected);
  });

  it("should have a title and a message for every refusal", () => {
    for (const [code, copy] of Object.entries(IMPORT_FILE_ERRORS)) {
      expect(copy.title, code).not.toBe("");
      expect(copy.message, code).not.toBe("");
    }
  });
});
