import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({ getCurrentUser: getCurrentUserMock }));

import { GET } from "@/app/api/bookings/import-template/route";
import { buildBookingImportTemplateCsv } from "@/features/bookings/lib/booking-import-template";

const asRole = (role: string) => getCurrentUserMock.mockResolvedValue({ id: "u-1", role });

describe("GET /api/bookings/import-template (CO-F07-S01)", () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset();
    asRole("operations_manager");
  });

  it("should give the template as a CSV download to an operations manager", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="booking-import-template.csv"',
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.text()).toBe(buildBookingImportTemplateCsv());
  });

  it("should give the template to an admin", async () => {
    asRole("admin");

    expect((await GET()).status).toBe(200);
  });

  it("should answer 401 when nobody is signed in", async () => {
    getCurrentUserMock.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("UNAUTHORIZED");
  });

  it.each(["partner_user", "technician"])("should answer 403 to a %s", async (role) => {
    asRole(role);

    const response = await GET();

    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("FORBIDDEN");
  });
});
