import { describe, expect, it, vi } from "vitest";

import { getTechnicianJobPartnerNames } from "@/features/jobs/lib/get-technician-job-partner-names";

const clientReturning = (result: { data: unknown; error: unknown }) => {
  const rpc = vi.fn().mockResolvedValue(result);

  return { client: { rpc } as never, rpc };
};

describe("getTechnicianJobPartnerNames (VI-F11-T02)", () => {
  it("should return the partner name of each job by job id", async () => {
    const { client, rpc } = clientReturning({
      data: [{ job_id: "j1", partner_name: "Emirates Rent A Car" }],
      error: null,
    });

    const names = await getTechnicianJobPartnerNames(client, ["j1", "j2"]);

    expect(rpc).toHaveBeenCalledWith("technician_job_partner_names", { p_job_ids: ["j1", "j2"] });
    expect(names.get("j1")).toBe("Emirates Rent A Car");
    expect(names.has("j2")).toBe(false);
  });

  it("should not call the database when there is no job (AC05)", async () => {
    const { client, rpc } = clientReturning({ data: [], error: null });

    expect((await getTechnicianJobPartnerNames(client, [])).size).toBe(0);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("should give no name, not an error, when the read fails", async () => {
    const { client } = clientReturning({ data: null, error: { message: "db down" } });

    expect((await getTechnicianJobPartnerNames(client, ["j1"])).size).toBe(0);
  });
});
