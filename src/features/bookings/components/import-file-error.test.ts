import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ImportFileError } from "@/features/bookings/components/import-file-error";
import { IMPORT_FILE_ERRORS, type ImportFileErrorCode } from "@/features/bookings/lib/booking-import-file";
import { bookingImportInputSchema } from "@/features/bookings/schemas/booking-import.schema";

const render = (code: ImportFileErrorCode) =>
  renderToStaticMarkup(
    createElement(ImportFileError, { file: { name: "bookings_dxb_07-nov-2026.csv", size: 19_500_000 }, code }),
  );

describe("ImportFileError (CO-F07-S02)", () => {
  it.each(["FILE_TOO_LARGE", "WRONG_HEADER", "UNSUPPORTED_ENCODING", "NOT_A_CSV"] as const)(
    "should show the file, why it was refused and the template link for %s",
    (code) => {
      const html = render(code);

      expect(html).toContain("bookings_dxb_07-nov-2026.csv");
      expect(html).toContain("18.6 MB · Could not validate");
      expect(html).toContain(IMPORT_FILE_ERRORS[code].title);
      expect(html).toContain("Before you try again");
      expect(html).toContain('href="/api/bookings/import-template"');
    },
  );
});

describe("bookingImportInputSchema (CO-F07-S02, V2)", () => {
  it("should accept a partner id, also a seeded one that is not an RFC UUID", () => {
    expect(bookingImportInputSchema.safeParse({ partner_id: "a0000000-0000-0000-0000-000000000001" }).success).toBe(true);
  });

  it.each([[""], ["x"]])("should refuse the partner %j with a clear message", (partner_id) => {
    const result = bookingImportInputSchema.safeParse({ partner_id });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Select a partner");
  });

  it("should refuse a missing partner", () => {
    expect(bookingImportInputSchema.safeParse({}).success).toBe(false);
  });
});
