import { describe, expect, it } from "vitest";

import { buildBreadcrumb } from "@/lib/layout/breadcrumb";

const MENU = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/bookings", label: "Bookings" },
  { href: "/seat-categories", label: "Seat Categories" },
  { href: "/partner", label: "Partner Portal" },
  { href: "/technician", label: "Technician Jobs" },
];
const ID = "3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b";

describe("buildBreadcrumb", () => {
  it("should name the area as the menu does and leave the current page without a link", () => {
    expect(buildBreadcrumb("/bookings", MENU)).toEqual([{ label: "Bookings", href: null }]);
  });

  it("should show a page of one record as Details, with a link back to the list", () => {
    expect(buildBreadcrumb(`/bookings/${ID}`, MENU)).toEqual([
      { label: "Bookings", href: "/bookings" },
      { label: "Details", href: null },
    ]);
  });

  it("should show the steps below a record: Details, then Edit", () => {
    expect(buildBreadcrumb(`/bookings/${ID}/edit`, MENU)).toEqual([
      { label: "Bookings", href: "/bookings" },
      { label: "Details", href: `/bookings/${ID}` },
      { label: "Edit", href: null },
    ]);
  });

  it("should name the new-record page New", () => {
    expect(buildBreadcrumb("/bookings/new", MENU).map((c) => c.label)).toEqual(["Bookings", "New"]);
  });

  it("should work for the partner and the technician areas", () => {
    expect(buildBreadcrumb("/partner/seats", MENU).map((c) => c.label)).toEqual([
      "Partner Portal",
      "Seats",
    ]);
    expect(buildBreadcrumb("/technician", MENU).map((c) => c.label)).toEqual(["Technician Jobs"]);
  });

  it("should write a word with hyphens as words", () => {
    expect(buildBreadcrumb(`/bookings/${ID}/revenue-split`, MENU).at(-1)?.label).toBe("Revenue split");
  });

  it("should ignore a trailing slash and an empty path", () => {
    expect(buildBreadcrumb("/bookings/", MENU)).toEqual([{ label: "Bookings", href: null }]);
    expect(buildBreadcrumb("/", MENU)).toEqual([]);
    expect(buildBreadcrumb("", MENU)).toEqual([]);
  });

  it.each(["12345", "9f8e7d6c5b4a39281706f5e4d3c2b1a0"])(
    "should treat %s as a record, not as a word",
    (id) => {
      expect(buildBreadcrumb(`/bookings/${id}`, MENU)[1].label).toBe("Details");
    },
  );

  it("should link nothing when the area is not in the menu, since its pages are not known", () => {
    expect(buildBreadcrumb("/q/some-token-1234567890abcdef", MENU)).toEqual([
      { label: "Q", href: null },
      { label: "Details", href: null },
    ]);
  });

  it("should name an area from the menu, not from its path", () => {
    expect(buildBreadcrumb("/seat-categories", MENU)[0].label).toBe("Seat Categories");
  });
});
