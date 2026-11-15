import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

import { getJobInformation } from "@/features/jobs/lib/get-job-information";

const ID = "11111111-1111-4111-8111-111111111111";

const ROW = {
  id: ID,
  job_number: "JOB-2026-0081",
  deadline_at: "2026-10-24T11:15:00Z",
  status: "assigned",
  job_type: "installation",
  vehicle_bay: null,
  technician: { full_name: "Omar Haddad" },
  booking: {
    booking_number: "BK-2026-000123",
    pickup_at: "2026-10-24T11:00:00Z",
    vehicle: "Toyota RAV4",
    vehicle_bay: "C-14",
    airport: { code: "DXB", name: "Dubai", city: "Dubai", timezone: "Asia/Dubai" },
    required_category: { name: "Convertible" },
    seat: { serial_number: "SEAT-0001" },
    flight: null,
  },
};

function mockQuery(result: { data: unknown; error: unknown }, partnerNames: { job_id: string; partner_name: string }[] = []) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  const rpc = vi.fn().mockResolvedValue({ data: partnerNames, error: null });
  createClientMock.mockResolvedValue({ from, rpc });
  return { from, eq, rpc };
}

describe("getJobInformation", () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it("should return the job with its partner name read for the technician", async () => {
    const { from, eq, rpc } = mockQuery({ data: ROW, error: null }, [{ job_id: ID, partner_name: "Emirates Rent A Car" }]);

    const job = await getJobInformation(ID);

    expect(from).toHaveBeenCalledWith("technician_jobs");
    expect(eq).toHaveBeenCalledWith("id", ID);
    expect(rpc).toHaveBeenCalledWith("technician_job_partner_names", { p_job_ids: [ID] });
    expect(job).toMatchObject({
      id: ID,
      job_number: "JOB-2026-0081",
      seat: "SEAT-0001",
      vehicle_bay: "C-14",
      partner_name: "Emirates Rent A Car",
    });
  });

  it("should return null without reading when the id is malformed", async () => {
    await expect(getJobInformation("not-an-id")).resolves.toBeNull();

    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("should return null when RLS hides the job, as for a job of another technician", async () => {
    mockQuery({ data: null, error: null });

    await expect(getJobInformation(ID)).resolves.toBeNull();
  });

  it("should throw when the read fails, so the page shows its error and not the forbidden state", async () => {
    mockQuery({ data: null, error: new Error("db down") });

    await expect(getJobInformation(ID)).rejects.toThrow("db down");
  });
});
