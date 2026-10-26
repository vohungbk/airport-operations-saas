import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ChecklistItem } from "@/components/domain/checklist-item";
import { PhotoUploader } from "@/components/domain/photo-uploader";
import { PhotoViewer } from "@/components/domain/photo-viewer";
import { QrCodeCard } from "@/components/domain/qr-code-card";
import { QrScannerOverlay } from "@/components/domain/qr-scanner-overlay";
import { SeatHistoryTimeline } from "@/components/domain/seat-history-timeline";
import { Timeline } from "@/components/domain/timeline";
import type { PhotoUploadItem } from "@/lib/field/photo-upload";

const html = (element: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(element);
const formatTime = (iso: string) => `T(${iso})`;

describe("QrCodeCard", () => {
  const card = () =>
    html(createElement(QrCodeCard, { svg: "<svg></svg>", seat_id: "SEAT-0042", download_href: "/api/seats/1/qr" }));

  it("should show the code, the seat ID, Download and Print", () => {
    const out = card();
    expect(out).toContain("<svg></svg>");
    expect(out).toContain("SEAT-0042");
    expect(out).toContain('href="/api/seats/1/qr"');
    expect(out).toContain("Download");
    expect(out).toContain("Print");
  });

  it("should say that sign-in is needed", () => {
    expect(card()).toContain("Sign-in is needed");
  });

  it("should hide its buttons when printed", () => {
    expect(card()).toContain("print:hidden");
  });

  it("should give Download a 44 px target on a touch screen", () => {
    expect(card()).toContain("pointer-coarse:min-h-11");
  });
});

describe("QrScannerOverlay", () => {
  const overlay = (props: object) =>
    html(createElement(QrScannerOverlay, { camera: "ready", type_code_href: "/q/code", ...props }));

  it("should show the frame, four corners, the torch and the type-the-code link", () => {
    const out = overlay({});
    expect(out).toContain('data-slot="qr-scanner-frame"');
    expect(out.match(/border-foreground/g)).toHaveLength(4);
    expect(out).toContain("Torch on");
    expect(out).toContain('href="/q/code"');
  });

  it("should offer the type-the-code link when the camera is not allowed", () => {
    const out = overlay({ camera: "denied" });
    expect(out).toContain("Camera access is not allowed");
    expect(out).toContain('data-slot="type-the-code-link"');
    expect(out).toContain('href="/q/code"');
    expect(out).not.toContain("Torch");
    expect(out).not.toContain('data-slot="qr-scanner-frame"');
  });

  it("should turn the torch button off while the camera is starting", () => {
    const out = overlay({ camera: "starting" });
    expect(out).toContain("Starting the camera");
    expect(out).toMatch(/<button[^>]*disabled/);
  });

  it("should say the torch is on and offer to turn it off", () => {
    const out = overlay({ torch_on: true });
    expect(out).toContain("Torch off");
    expect(out).not.toContain("Torch on");
  });

  it("should give the torch and the link a 44 px target on a touch screen", () => {
    const out = overlay({});
    expect(out.match(/pointer-coarse:min-h-11/g)?.length).toBeGreaterThanOrEqual(2);
  });
});

describe("PhotoUploader", () => {
  const item = (over: Partial<PhotoUploadItem> = {}): PhotoUploadItem => ({
    id: "p1",
    file_name: "installation-photo.jpg",
    status: "uploaded",
    thumbnail_url: "https://files.example.test/p1.jpg",
    ...over,
  });
  const uploader = (props: object) => html(createElement(PhotoUploader, { items: [], ...props }));

  it("should show the empty state with the camera and file buttons", () => {
    const out = uploader({});
    expect(out).toContain('data-state="empty"');
    expect(out).toContain("Take photo");
    expect(out).toContain("Choose files");
    expect(out).toContain("Maximum 10 MB per photo");
  });

  it("should show the camera state with Capture and Close", () => {
    const out = uploader({ camera_open: true });
    expect(out).toContain('data-state="camera"');
    expect(out).toContain("Capture");
    expect(out).toContain("Close camera");
  });

  it("should show the progress of an upload", () => {
    const out = uploader({ items: [item({ status: "uploading", progress: 68, thumbnail_url: undefined })] });
    expect(out).toContain("Uploading · 68%");
    expect(out).toContain('aria-valuenow="68"');
    expect(out).not.toContain("Remove");
  });

  it("should keep the bar inside 0 to 100", () => {
    const out = uploader({ items: [item({ status: "uploading", progress: 250, thumbnail_url: undefined })] });
    expect(out).toContain('aria-valuenow="100"');
  });

  it("should show an uploaded photo as a thumbnail with a remove button", () => {
    const out = uploader({ items: [item()] });
    expect(out).toContain('data-slot="photo-thumbnail"');
    expect(out).toContain("Uploaded");
    expect(out).toContain('aria-label="Remove installation-photo.jpg"');
  });

  it("should show a failed upload with an icon, text and a retry button", () => {
    const out = uploader({ items: [item({ status: "failed", thumbnail_url: undefined })] });
    expect(out).toContain('data-status="failed"');
    expect(out).toContain("Upload failed");
    expect(out).toContain("<svg");
    expect(out).toContain('aria-label="Retry installation-photo.jpg"');
    expect(out).toContain("Remove");
  });

  it("should give retry and remove a 44 px target on a touch screen", () => {
    const out = uploader({ items: [item({ status: "failed", thumbnail_url: undefined })] });
    expect(out).toContain("pointer-coarse:min-h-11");
    expect(out).toContain("pointer-coarse:size-11");
  });
});

describe("PhotoViewer", () => {
  it("should show the photo, its caption and its time", () => {
    const out = html(
      createElement(PhotoViewer, {
        formatTime,
        photo: { url: "https://files.example.test/a.jpg", alt: "Seat after cleaning", caption: "Clean seat", taken_at: "2026-11-24T10:00:00Z" },
      }),
    );
    expect(out).toContain("Clean seat");
    expect(out).toContain("T(2026-11-24T10:00:00Z)");
    expect(out).toContain('alt="Seat after cleaning"');
  });

  it("should say the time is not recorded when there is none", () => {
    const out = html(createElement(PhotoViewer, { formatTime, photo: { url: "https://x.test/a.jpg", alt: "a", caption: null, taken_at: null } }));
    expect(out).toContain("Time not recorded");
  });

  it("should say there is no photo, not draw an empty frame", () => {
    const out = html(createElement(PhotoViewer, { formatTime, photo: null }));
    expect(out).toContain("No photo to show.");
    expect(out).not.toContain("<img");
  });
});

describe("Timeline", () => {
  it("should show each event with its actor, time, note and photo", () => {
    const out = html(
      createElement(Timeline, {
        formatTime,
        events: [
          {
            id: "e1",
            actor: "An Nguyen",
            occurred_at: "2026-11-24T09:00:00Z",
            note: "Seat checked",
            photos: [{ id: "ph1", url: "https://files.example.test/1.jpg", alt: "Seat" }],
          },
        ],
      }),
    );
    expect(out).toContain("An Nguyen");
    expect(out).toContain("T(2026-11-24T09:00:00Z)");
    expect(out).toContain("Seat checked");
    expect(out).toContain('data-slot="photo-thumbnail"');
  });

  it("should say there are no events, not draw an empty list", () => {
    const out = html(createElement(Timeline, { formatTime, events: [] }));
    expect(out).toContain("No events yet.");
    expect(out).not.toContain("<ol");
  });

  it("should write Unknown when the actor is missing", () => {
    const out = html(createElement(Timeline, { formatTime, events: [{ id: "e1", actor: null, occurred_at: "2026-11-24T09:00:00Z" }] }));
    expect(out).toContain("Unknown");
  });
});

describe("ChecklistItem", () => {
  const row = (props: object) => html(createElement(ChecklistItem, { label: "Check the belt", checked: false, ...props }));

  it("should show the label", () => {
    expect(row({})).toContain("Check the belt");
  });

  it("should mark a required item with text and an icon", () => {
    const out = row({ required: true });
    expect(out).toContain("Required");
    expect(out).toContain("<svg");
    expect(out).toContain('data-required="true"');
  });

  it("should not mark an optional item", () => {
    expect(row({})).not.toContain("Required");
  });

  it("should say a required open item is needed, in words, when asked", () => {
    const out = row({ required: true, show_error: true });
    expect(out).toContain("This item is required.");
    expect(out).toContain('role="alert"');
  });

  it("should not show the error for a required item that is checked", () => {
    expect(row({ required: true, checked: true, show_error: true })).not.toContain("This item is required.");
  });

  it("should give the row a 44 px target on a touch screen", () => {
    expect(row({})).toContain("pointer-coarse:min-h-11");
  });
});

describe("SeatHistoryTimeline", () => {
  const history = [
    { id: "h1", from_status: null, to_status: "available", changed_by: "An Nguyen", created_at: "2026-11-24T08:00:00Z", reason: null },
    { id: "h2", from_status: "available", to_status: "quarantine", changed_by: null, created_at: "2026-11-24T09:00:00Z", reason: "Cracked shell" },
  ];

  it("should show each change with who made it and why", () => {
    const out = html(createElement(SeatHistoryTimeline, { history, formatTime }));
    expect(out).toContain("An Nguyen");
    expect(out).toContain("Cracked shell");
    expect(out).toContain('data-status="quarantine"');
  });

  it("should write Created for the first entry, which has no old status", () => {
    expect(html(createElement(SeatHistoryTimeline, { history, formatTime }))).toContain("Created");
  });

  it("should say there is no history, not draw zeros", () => {
    expect(html(createElement(SeatHistoryTimeline, { history: [], formatTime }))).toContain("No events yet.");
  });
});
