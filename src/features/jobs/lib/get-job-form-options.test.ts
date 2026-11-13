import { beforeEach, describe, expect, it, vi } from "vitest";

import { ACTIVE_BOOKING_STATUSES } from "@/features/bookings/lib/booking-status";

const calls = vi.hoisted(() => ({
  filters: [] as Array<[string, string, unknown]>,
  results: {} as Record<string, { data: unknown; error: unknown }>,
  rpc: { data: [], error: null } as { data: unknown; error: unknown },
  rpcArgs: [] as unknown[],
}));

function builder(table: string) {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "order", "limit"]) {
    chain[method] = () => chain;
  }
  chain.eq = (column: string, value: unknown) => {
    calls.filters.push([table, column, value]);
    return chain;
  };
  chain.in = (column: string, value: unknown) => {
    calls.filters.push([table, column, value]);
    return chain;
  };
  chain.then = (resolve: (value: unknown) => unknown) =>
    resolve(calls.results[table]);
  return chain;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: (table: string) => builder(table),
    rpc: async (_name: string, args: unknown) => {
      calls.rpcArgs.push(args);
      return calls.rpc;
    },
  })),
}));

import { getJobFormOptions } from "@/features/jobs/lib/get-job-form-options";

describe("getJobFormOptions", () => {
  beforeEach(() => {
    calls.filters = [];
    calls.rpcArgs = [];
    calls.rpc = {
      data: [{ technician_id: "t-1", airport_code: "DXB" }],
      error: null,
    };
    calls.results = {
      users: {
        data: [
          { id: "t-1", full_name: "Ahmed", is_active: true },
          { id: "t-2", full_name: "Sofia", is_active: false },
        ],
        error: null,
      },
      bookings: {
        data: [{ id: "b-1", booking_number: "BK-00001" }],
        error: null,
      },
    };
  });

  it("should list every technician with the active flag and airport, and only active bookings", async () => {
    const options = await getJobFormOptions();

    expect(calls.filters).toContainEqual(["users", "role", "technician"]);
    expect(calls.filters).not.toContainEqual(["users", "is_active", true]);
    expect(calls.rpcArgs).toEqual([{ p_technician_ids: ["t-1", "t-2"] }]);
    expect(calls.filters).toContainEqual([
      "bookings",
      "status",
      [...ACTIVE_BOOKING_STATUSES],
    ]);
    expect(options).toEqual({
      technicians: [
        { value: "t-1", label: "Ahmed", is_active: true, airport_code: "DXB" },
        { value: "t-2", label: "Sofia", is_active: false, airport_code: null },
      ],
      bookings: [{ value: "b-1", label: "BK-00001" }],
    });
  });

  it("should throw when the airport figures fail", async () => {
    calls.rpc = { data: null, error: new Error("rpc boom") };

    await expect(getJobFormOptions()).rejects.toThrow("rpc boom");
  });

  it("should throw when a query fails", async () => {
    calls.results.bookings = { data: null, error: new Error("boom") };

    await expect(getJobFormOptions()).rejects.toThrow("boom");
  });
});
