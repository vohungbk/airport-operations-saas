import { beforeEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({
  filters: [] as Array<[string, string, unknown]>,
  results: {} as Record<string, { data: unknown; error: unknown }>,
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
  createClient: vi.fn(async () => ({ from: (table: string) => builder(table) })),
}));

import { getJobFormOptions } from "@/features/jobs/lib/get-job-form-options";

describe("getJobFormOptions", () => {
  beforeEach(() => {
    calls.filters = [];
    calls.results = {
      users: { data: [{ id: "t-1", full_name: "Ahmed" }], error: null },
      bookings: {
        data: [{ id: "b-1", booking_number: "BK-00001" }],
        error: null,
      },
    };
  });

  it("should offer only active technicians and active bookings", async () => {
    const options = await getJobFormOptions();

    expect(calls.filters).toContainEqual(["users", "role", "technician"]);
    expect(calls.filters).toContainEqual(["users", "is_active", true]);
    expect(calls.filters).toContainEqual([
      "bookings",
      "status",
      ["pending", "confirmed", "assigned", "in_progress"],
    ]);
    expect(options).toEqual({
      technicians: [{ value: "t-1", label: "Ahmed" }],
      bookings: [{ value: "b-1", label: "BK-00001" }],
    });
  });

  it("should throw when a query fails", async () => {
    calls.results.bookings = { data: null, error: new Error("boom") };

    await expect(getJobFormOptions()).rejects.toThrow("boom");
  });
});
