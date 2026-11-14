import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/features/bookings/actions/get-booking-photo-link.action", () => ({ getBookingPhotoLinkAction: vi.fn() }));

import { PhotoViewerDenied } from "@/features/bookings/components/photo-viewer-denied";
import { PhotoViewerScreen } from "@/features/bookings/components/photo-viewer-screen";
import { photoCountLabel, type BookingPhoto } from "@/features/bookings/lib/booking-photos";

const photo = (id: string, caption: string): BookingPhoto => ({
  id,
  url: `https://signed/${id}`,
  caption,
  type: "installation",
  uploader_name: "Nguyen Van An",
  taken_at: "2026-11-04T02:12:00Z",
});

const render = (props: { photos?: BookingPhoto[]; failed?: boolean }) =>
  renderToStaticMarkup(
    createElement(PhotoViewerScreen, {
      photos: props.photos ?? [],
      failed: props.failed ?? false,
      timeZone: "Asia/Ho_Chi_Minh",
      links: [{ label: "← Back to record", href: "/jobs/j-1/inspection" }],
      subtitle: "Inspection record · SEAT-0001 · Noi Bai (HAN)",
      scope: "record",
      contextLabel: "SEAT-0001 · Inspection record",
    }),
  );

describe("PhotoViewerScreen", () => {
  it("should list the photos and open the first one with who added it and when", () => {
    const html = render({ photos: [photo("p-1", "Harness checked"), photo("p-2", "Buckle secured")] });

    expect(html).toContain("2 photos");
    expect(html).toContain("Buckle secured");
    expect(html).toContain("Photo 1 of 2");
    expect(html).toContain("Added by Nguyen Van An");
    expect(html).toContain("04 Nov 2026, 09:12");
    expect(html).toContain("SEAT-0001 · Inspection record");
  });

  it("should say there are no photos yet when the record has none", () => {
    const html = render({});

    expect(html).toContain("No photos yet");
    expect(html).toContain("Photos added to this record will appear here.");
    expect(html).not.toContain("Photo preview");
  });

  it("should show the error with Retry and no photo list when the photos could not be read", () => {
    const html = render({ failed: true });

    expect(html).toContain("Could not load photos");
    expect(html).toContain("Retry");
    expect(html).toContain("Photo list unavailable");
  });
});

describe("PhotoViewerDenied", () => {
  it("should say the user has no access and show no photo", () => {
    const html = renderToStaticMarkup(createElement(PhotoViewerDenied, { links: [], backHref: "/jobs" }));

    expect(html).toContain("You do not have access to these photos");
    expect(html).toContain('href="/jobs"');
    expect(html).not.toContain("<img");
  });
});

describe("photoCountLabel", () => {
  it.each([
    [0, "0 photos"],
    [1, "1 photo"],
    [6, "6 photos"],
  ])("should write %i as %s", (count, label) => {
    expect(photoCountLabel(count)).toBe(label);
  });
});
