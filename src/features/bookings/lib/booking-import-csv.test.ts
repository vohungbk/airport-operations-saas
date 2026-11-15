import { describe, expect, it } from "vitest";

import { parseCsv } from "@/features/bookings/lib/booking-import-csv";

describe("parseCsv (CO-F07-S03)", () => {
  it.each([
    ["LF lines", "a,b\n1,2\n", [["a", "b"], ["1", "2"]]],
    ["CRLF lines", "a,b\r\n1,2\r\n", [["a", "b"], ["1", "2"]]],
    ["no line break at the end", "a,b\n1,2", [["a", "b"], ["1", "2"]]],
    ["empty cells", "a,,c\n,,", [["a", "", "c"], ["", "", ""]]],
    ["a comma in quotes", 'a,"x, y"\n', [["a", "x, y"]]],
    ["a quote written twice", 'a,"say ""hi"""\n', [["a", 'say "hi"']]],
    ["a line break in quotes", 'a,"x\ny"\n', [["a", "x\ny"]]],
    ["empty lines between rows", "a\n\n\nb\n", [["a"], ["b"]]],
    ["nothing", "", []],
  ])("should read %s", (_label, text, expected) => {
    expect(parseCsv(text)).toEqual(expected);
  });
});
