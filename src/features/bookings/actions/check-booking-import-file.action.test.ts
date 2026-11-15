import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAnyPermissionMock = vi.hoisted(() => vi.fn());
const maybeSingleMock = vi.hoisted(() => vi.fn());
const fromMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({ requireAnyPermission: requireAnyPermissionMock }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({ from: fromMock })) }));

import { checkBookingImportFileAction } from "@/features/bookings/actions/check-booking-import-file.action";
import { BOOKING_IMPORT_MAX_FILE_BYTES } from "@/features/bookings/lib/booking-import-file";
import { buildBookingImportTemplateCsv } from "@/features/bookings/lib/booking-import-template";

const PARTNER_ID = "a0000000-0000-0000-0000-000000000001";
const VALID_CSV = `${buildBookingImportTemplateCsv()}EXT-1,2026-11-08 09:30,,EK 203,Infant,,,,\r\n`;

const form = (fields: { partner_id?: string; file?: File | string } = {}) => {
  const data = new FormData();
  const { partner_id = PARTNER_ID, file = new File([VALID_CSV], "bookings.csv", { type: "text/csv" }) } = fields;
  if (partner_id) data.set("partner_id", partner_id);
  if (file !== "") data.set("file", file);
  return data;
};

describe("checkBookingImportFileAction (CO-F07-S02)", () => {
  beforeEach(() => {
    requireAnyPermissionMock.mockReset();
    requireAnyPermissionMock.mockResolvedValue({ id: "u-1", role: "operations_manager" });
    maybeSingleMock.mockReset();
    maybeSingleMock.mockResolvedValue({ data: { id: PARTNER_ID }, error: null });
    fromMock.mockReset();
    fromMock.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: maybeSingleMock }) }) });
  });

  it("should accept a CSV with the template header for a partner the user can read", async () => {
    expect(await checkBookingImportFileAction(form())).toEqual({ success: true });
    expect(requireAnyPermissionMock).toHaveBeenCalledWith(["bookings:manage"]);
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
    const data = form({ file: new File([VALID_CSV], "bookings.xlsx") });

    expect(await checkBookingImportFileAction(data)).toEqual({ success: false, code: "NOT_A_CSV" });
  });

  it("should refuse a file over the limit before reading any of it", async () => {
    const big = new File([VALID_CSV], "bookings.csv");
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

  it("should refuse a user without the import permission and look at nothing", async () => {
    requireAnyPermissionMock.mockRejectedValue(new Error("FORBIDDEN"));

    await expect(checkBookingImportFileAction(form())).rejects.toThrow("FORBIDDEN");
    expect(fromMock).not.toHaveBeenCalled();
  });
});
