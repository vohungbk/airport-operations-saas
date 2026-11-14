import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAnyPermissionMock = vi.hoisted(() => vi.fn());
const getJobMock = vi.hoisted(() => vi.fn());
const getPhotosMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({ requireAnyPermission: requireAnyPermissionMock }));
vi.mock("@/features/jobs/lib/get-job-by-id", () => ({ getJobById: getJobMock }));
vi.mock("@/features/bookings/lib/get-booking-photos", () => ({ getBookingPhotos: getPhotosMock }));
vi.mock("@/features/bookings/actions/get-booking-photo-link.action", () => ({ getBookingPhotoLinkAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import JobPhotosPage from "@/app/(dashboard)/jobs/[id]/photos/page";

const JOB = {
  id: "j-1",
  job_type: "inspection",
  booking: {
    id: "b-1",
    airport: { code: "HAN", name: "Noi Bai", timezone: "Asia/Ho_Chi_Minh" },
    seat: { id: "s-1", serial_number: "SEAT-0001" },
  },
};
const params = Promise.resolve({ id: "j-1" });
const render = async () => renderToStaticMarkup(await JobPhotosPage({ params }));

describe("JobPhotosPage", () => {
  beforeEach(() => {
    requireAnyPermissionMock.mockReset();
    requireAnyPermissionMock.mockResolvedValue({ id: "u-1", role: "operations_manager" });
    getJobMock.mockReset();
    getJobMock.mockResolvedValue(JOB);
    getPhotosMock.mockReset();
    getPhotosMock.mockResolvedValue({ photos: [], failed: false });
  });

  it("should show the photos of the booking of the job with the way back to the record and the seat", async () => {
    const html = await render();

    expect(getPhotosMock).toHaveBeenCalledWith("b-1");
    expect(html).toContain("Inspection record · SEAT-0001 · Noi Bai (HAN)");
    expect(html).toContain('href="/jobs/j-1/inspection"');
    expect(html).toContain('href="/seats/s-1"');
  });

  it("should show the denied state and read no photo when the job is not in the user's scope", async () => {
    getJobMock.mockResolvedValue(null);

    const html = await render();

    expect(html).toContain("You do not have access to these photos");
    expect(getPhotosMock).not.toHaveBeenCalled();
  });

  it("should not offer the seat history to a technician", async () => {
    requireAnyPermissionMock.mockResolvedValue({ id: "u-2", role: "technician" });

    expect(await render()).not.toContain('href="/seats/s-1"');
  });
});
