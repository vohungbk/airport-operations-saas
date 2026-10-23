import { describe, expect, it } from "vitest";

import { safeNextPath } from "@/lib/auth/safe-next-path";

/**
 * FO-F03-S11 (spec E11, AC03): after signing in, a person is sent back to the page they
 * asked for, and never to another site. The value comes from the query string.
 */
describe("safeNextPath", () => {
  it.each([
    ["/seats/5e2a2c8e-8f7c-4d3c-9d3f-1f7f5b5b7c11/cleaning", "/seats/5e2a2c8e-8f7c-4d3c-9d3f-1f7f5b5b7c11/cleaning"],
    ["/jobs/abc/cleaning", "/jobs/abc/cleaning"],
    ["/bookings?status=pending&page=2", "/bookings?status=pending&page=2"],
    ["/dashboard", "/dashboard"],
    ["/seats/x?q=https://example.com", "/seats/x?q=https://example.com"],
  ])("should keep a path of the app: %s", (value, expected) => {
    expect(safeNextPath(value)).toBe(expected);
  });

  it("should drop the fragment, which a server never sees", () => {
    expect(safeNextPath("/seats/x/cleaning#top")).toBe("/seats/x/cleaning");
  });

  it.each([
    ["an address of another site", "https://evil.example/seats"],
    ["a scheme-relative address", "//evil.example/seats"],
    ["a scheme-relative address with a backslash", "/\\evil.example/seats"],
    ["a backslash after a slash", "/\\/evil.example"],
    ["a backslash inside the path", "/seats\\..\\evil"],
    ["a tab that a browser drops", "/\t/evil.example"],
    ["a line break that a browser drops", "/\n/evil.example"],
    ["a space", "/seats /x"],
    ["a null byte", "/seats/\u0000x"],
    ["javascript", "javascript:alert(1)"],
    ["a data address", "data:text/html,x"],
    ["a path with no leading slash", "seats/x"],
    ["a dot path", "./seats"],
    ["an empty value", ""],
    ["a value that is too long", `/${"a".repeat(600)}`],
  ])("should refuse %s", (_name, value) => {
    expect(safeNextPath(value)).toBeNull();
  });

  it.each([
    ["the sign in page", "/login"],
    ["the sign in page with a query", "/login?next=/seats"],
    ["the sign up page", "/signup"],
    ["the reset page", "/reset-password"],
    ["the forbidden page", "/forbidden"],
    ["an api route", "/api/auth/confirm"],
  ])("should not send a person back to %s", (_name, value) => {
    expect(safeNextPath(value)).toBeNull();
  });

  it("should not take a path that only starts with the name of such a page", () => {
    expect(safeNextPath("/login-help")).toBe("/login-help");
    expect(safeNextPath("/apiary")).toBe("/apiary");
  });

  it.each([[undefined], [null], [42], [["/seats"]], [{ path: "/seats" }]])(
    "should refuse a value that is not a string: %j",
    (value) => {
      expect(safeNextPath(value)).toBeNull();
    },
  );

  it("should keep an encoded slash as it is, since it is a character of the path, not a new host", () => {
    expect(safeNextPath("/%2F%2Fevil.example")).toBe("/%2F%2Fevil.example");
  });
});
