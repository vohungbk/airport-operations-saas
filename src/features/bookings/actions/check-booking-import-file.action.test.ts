import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAuthMock = vi.hoisted(() => vi.fn());
const maybeSingleMock = vi.hoisted(() => vi.fn());
const fromMock = vi.hoisted(() => vi.fn());
const lookupsMock = vi.hoisted(() => vi.fn());
const existingMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({ requireAuth: requireAuthMock }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({ from: fromMock })) }));
vi.mock("@/features/bookings/lib/get-booking-import-lookups", () => ({
  getBookingImportLookups: lookupsMock,
  getExistingExternalNumbers: existingMock,
}));

import { checkBookingImportFileAction } from "@/features/bookings/actions/check-booking-import-file.action";
import {
  BOOKING_IMPORT_MAX_FILE_BYTES,
  BOOKING_IMPORT_MAX_ROWS,
} from "@/features/bookings/lib/booking-import-file";
import { buildBookingImportTemplateCsv } from "@/features/bookings/lib/booking-import-template";

const PARTNER_ID = "a0000000-0000-0000-0000-000000000001";
const AIRPORT_ID = "b0000000-0000-0000-0000-000000000001";
const GOOD_ROW = "EXT-1,2026-11-08 09:30,2026-11-10 09:30,EK 203,Infant,0-12 months,Sedan,,45.50";
const BAD_ROW = "EXT-2,2026-11-08 09:30,2026-11-10 09:30,EK 203,Premium,,,,45.50";
const csv = (...rows: string[]) => [buildBookingImportTemplateCsv().trim(), ...rows].join("\r\n");

const form = (fields: { partner_id?: string; file?: File | string } = {}) => {
  const data = new FormData();
  const { partner_id = PARTNER_ID, file = new File([csv(GOOD_ROW)], "bookings.csv", { type: "text/csv" }) } = fields;
  if (partner_id) data.set("partner_id", partner_id);
  if (file !== "") data.set("file", file);
  return data;
};

describe("checkBookingImportFileAction (CO-F07-S02, S03)", () => {
  beforeEach(() => {
    requireAuthMock.mockReset();
    requireAuthMock.mockResolvedValue({ id: "u-1", role: "operations_manager" });
    maybeSingleMock.mockReset();
    maybeSingleMock.mockResolvedValue({ data: { id: PARTNER_ID, name: "Emirates Rent A Car" }, error: null });
    fromMock.mockReset();
    fromMock.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: maybeSingleMock }) }) });
    existingMock.mockReset();
    existingMock.mockResolvedValue(new Set());
    lookupsMock.mockReset();
    lookupsMock.mockResolvedValue({
      airport: { id: AIRPORT_ID, timezone: "Asia/Dubai" },
      categoryIdsByName: new Map([["infant", "c0000000-0000-0000-0000-000000000001"]]),
    });
  });

  it("should answer with the report of a file whose header and rows are checked, and save nothing", async () => {
    const data = form({ file: new File([csv(GOOD_ROW, BAD_ROW)], "bookings.csv") });

    const result = await checkBookingImportFileAction(data);

    expect(result).toMatchObject({
      success: true,
      report: { total: 2, valid: 1, invalid: 1, partner_name: "Emirates Rent A Car", timezone: "Asia/Dubai" },
    });
    expect(result.success && result.report.rows.map((row) => row.error)).toEqual([null, "Seat category not found"]);
    // Only reads: the partner by id; nothing is inserted or updated.
    expect(fromMock.mock.calls.map(([table]) => table)).toEqual(["partners"]);
    });

  it("should mark a row that repeats a number the partner already has as a duplicate, and not change that booking (S04)", async () => {
    existingMock.mockResolvedValue(new Set(["EXT-1"]));

    const result = await checkBookingImportFileAction(form({ file: new File([csv(GOOD_ROW)], "bookings.csv") }));

    expect(result).toMatchObject({ success: true, report: { total: 1, valid: 0, invalid: 1 } });
    expect(result.success && result.report.rows[0]).toMatchObject({ status: "duplicate", error: "Duplicate external booking number" });
    expect(existingMock).toHaveBeenCalledWith(expect.anything(), PARTNER_ID, ["EXT-1"]);
    expect(fromMock.mock.calls.map(([table]) => table)).toEqual(["partners"]);
  });

  it.each([
    ["no partner", form({ partner_id: "" })],
    ["a partner that is not an id", form({ partner_id: "not-an-id" })],
  ])("should answer PARTNER_REQUIRED for %s", async (_label, data) => {
    expect(await checkBookingImportFileAction(data)).toEqual({ success: false, code: "PARTNER_REQUIRED" });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("should answer PARTNER_REQUIRED for a partner the user cannot read", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });

    expect(await checkBookingImportFileAction(form())).toEqual({ success: false, code: "PARTNER_REQUIRED" });
  });

  it("should answer FILE_REQUIRED when no file is sent", async () => {
    expect(await checkBookingImportFileAction(form({ file: "" }))).toEqual({ success: false, code: "FILE_REQUIRED" });
  });

  it("should answer NOT_A_CSV for another file type", async () => {
    const data = form({ file: new File([csv(GOOD_ROW)], "bookings.xlsx") });

    expect(await checkBookingImportFileAction(data)).toEqual({ success: false, code: "NOT_A_CSV" });
  });

  it("should refuse a file over the limit before reading any of it", async () => {
    const big = new File([csv(GOOD_ROW)], "bookings.csv");
    Object.defineProperty(big, "size", { value: BOOKING_IMPORT_MAX_FILE_BYTES + 1 });
    const readMock = vi.spyOn(big, "arrayBuffer");

    expect(await checkBookingImportFileAction(form({ file: big }))).toEqual({ success: false, code: "FILE_TOO_LARGE" });
    expect(readMock).not.toHaveBeenCalled();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("should answer UNSUPPORTED_ENCODING for a file that is not UTF-8", async () => {
    const data = form({ file: new File([new Uint8Array([0xff, 0xfe, 0x41, 0x00])], "bookings.csv") });

    expect(await checkBookingImportFileAction(data)).toEqual({ success: false, code: "UNSUPPORTED_ENCODING" });
  });

  it("should answer WRONG_HEADER for a file whose header is not the template", async () => {
    const data = form({ file: new File(["booking,time\r\nEXT-1,09:30"], "bookings.csv") });

    expect(await checkBookingImportFileAction(data)).toEqual({ success: false, code: "WRONG_HEADER" });
  });

  it("should answer NO_ROWS for a file with only the header", async () => {
    const data = form({ file: new File([csv()], "bookings.csv") });

    expect(await checkBookingImportFileAction(data)).toEqual({ success: false, code: "NO_ROWS" });
  });

  it("should answer TOO_MANY_ROWS for a file over the row limit, before any row is checked", async () => {
    const rows = Array.from({ length: BOOKING_IMPORT_MAX_ROWS + 1 }, () => GOOD_ROW);
    const data = form({ file: new File([csv(...rows)], "bookings.csv") });

    expect(await checkBookingImportFileAction(data)).toEqual({ success: false, code: "TOO_MANY_ROWS" });
    expect(lookupsMock).not.toHaveBeenCalled();
  });

  it("should answer AIRPORT_UNAVAILABLE when the account does not see exactly one airport", async () => {
    lookupsMock.mockResolvedValue({ airport: null, categoryIdsByName: new Map() });

    expect(await checkBookingImportFileAction(form())).toEqual({ success: false, code: "AIRPORT_UNAVAILABLE" });
  });

  it("should answer FORBIDDEN for a user without the import permission (any more) and look at nothing (S13, E10)", async () => {
    requireAuthMock.mockResolvedValue({ id: "u-2", role: "partner_user", full_name: "Sam Lee" });

    expect(await checkBookingImportFileAction(form())).toEqual({ success: false, code: "FORBIDDEN" });
    expect(fromMock).not.toHaveBeenCalled();
  });
});
