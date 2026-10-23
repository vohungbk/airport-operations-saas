import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserMock = vi.hoisted(() => vi.fn());
const getSeatByIdMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({ getCurrentUser: getCurrentUserMock }));
vi.mock("@/features/seats/lib/get-seat-by-id", () => ({ getSeatById: getSeatByIdMock }));

import { GET } from "@/app/api/seats/[id]/qr/route";

const SEAT_ID = "e0000000-0000-0000-0000-000000000008";
const TOKEN = "00000000-0000-4000-8000-0000000000a1";

const call = (id = SEAT_ID) =>
  GET(new Request("http://localhost/api/seats/x/qr") as never, { params: Promise.resolve({ id }) });

const asRole = (role: string) => getCurrentUserMock.mockResolvedValue({ id: "u-1", role });

/**
 * CO-F04-S12 (AC03): the QR download. It needs a signed-in user with the seat permission, and
 * answers in the standardized error shape otherwise.
 */
describe("GET /api/seats/[id]/qr", () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset();
    getSeatByIdMock.mockReset();
    getSeatByIdMock.mockResolvedValue({ id: SEAT_ID, serial_number: "SEAT-0008", public_token: TOKEN });
    asRole("operations_manager");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("should give the SVG of the seat as a download to an operations manager", async () => {
    const response = await call();
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/svg+xml");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="seat-SEAT-0008-qr.svg"');
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(body.startsWith("<svg")).toBe(true);
  });

  it("should give an admin the image too", async () => {
    asRole("admin");

    expect((await call()).status).toBe(200);
  });

  it("should not put the serial number or the token in the image", async () => {
    const body = await (await call()).text();

    expect(body).not.toContain("SEAT-0008");
    expect(body).not.toContain(TOKEN);
  });

  it("should answer 401 when nobody is signed in, and read nothing", async () => {
    getCurrentUserMock.mockResolvedValue(null);

    const response = await call();

    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("UNAUTHORIZED");
    expect(getSeatByIdMock).not.toHaveBeenCalled();
  });

  it.each([["technician"], ["partner_user"]])(
    "should answer 403 for a %s, and read nothing",
    async (role) => {
      asRole(role);

      const response = await call();

      expect(response.status).toBe(403);
      expect((await response.json()).error.code).toBe("FORBIDDEN");
      expect(getSeatByIdMock).not.toHaveBeenCalled();
    },
  );

  it("should answer 400 for an id that is not an id, and read nothing", async () => {
    const response = await call("not-an-id");

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
    expect(getSeatByIdMock).not.toHaveBeenCalled();
  });

  it("should answer 500 in the standard shape, not an unhandled error, when the public address is not set in production", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("NODE_ENV", "production");

    const response = await call();

    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("INTERNAL_ERROR");
  });

  it("should answer 404 for an unknown seat or one RLS hides, with no image", async () => {
    getSeatByIdMock.mockResolvedValue(null);

    const response = await call();

    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("NOT_FOUND");
  });
});
