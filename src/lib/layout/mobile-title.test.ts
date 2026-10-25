import { describe, expect, it } from "vitest";

import { buildBreadcrumb } from "@/lib/layout/breadcrumb";
import { buildMobileAppBar } from "@/lib/layout/mobile-title";

const MENU = [
  { href: "/bookings", label: "Bookings" },
  { href: "/partner", label: "Partner Portal" },
];
const ID = "3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b";
const barOf = (path: string) => buildMobileAppBar(buildBreadcrumb(path, MENU));

describe("buildMobileAppBar", () => {
  it("should give a top-level page its area as the title and no back arrow", () => {
    expect(barOf("/bookings")).toEqual({ title: "Bookings", backHref: null });
  });

  it("should give a detail page the title Details and an arrow back to the list", () => {
    expect(barOf(`/bookings/${ID}`)).toEqual({ title: "Details", backHref: "/bookings" });
  });

  it("should send the arrow of an edit page to the detail page", () => {
    expect(barOf(`/bookings/${ID}/edit`)).toEqual({ title: "Edit", backHref: `/bookings/${ID}` });
  });

  it("should send the arrow of a new-record page to the list", () => {
    expect(barOf("/bookings/new")).toEqual({ title: "New", backHref: "/bookings" });
  });

  it("should send the arrow to the dashboard when the area above has no page of its own", () => {
    expect(barOf("/q/some-token-1234567890abcdef")).toEqual({ title: "Details", backHref: "/dashboard" });
  });

  it("should name the app when there is no path", () => {
    expect(barOf("/")).toEqual({ title: "Airport Operations", backHref: null });
  });
});
