import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

import { getSeatLastChecks } from "@/features/installations/lib/get-seat-last-checks";

type Result = { data: unknown; error: unknown };

function mockTables(tables: Record<string, Result>) {
  const from = vi.fn((table: string) => {
    const chain: Record<string, unknown> = {};
    for (const method of ["select", "eq", "not", "order", "limit"]) {
      chain[method] = vi.fn(() => chain);
    }
    chain.maybeSingle = vi.fn().mockResolvedValue(tables[table]);
    return chain;
  });
  createClientMock.mockResolvedValue({ from });
  return from;
}

describe("getSeatLastChecks", () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it("should give the last cleaning and the last inspection of the seat", async () => {
    const from = mockTables({
      cleaning_records: { data: { completed_at: "2026-10-24T09:20:00Z", passed: true }, error: null },
      inspection_records: { data: { created_at: "2026-10-24T09:45:00Z", result: "pass" }, error: null },
    });

    await expect(getSeatLastChecks("s-1")).resolves.toEqual({
      last_cleaning: { at: "2026-10-24T09:20:00Z", passed: true },
      last_inspection: { at: "2026-10-24T09:45:00Z", result: "pass" },
    });
    expect(from).toHaveBeenCalledWith("cleaning_records");
    expect(from).toHaveBeenCalledWith("inspection_records");
  });

  it("should give null for a seat that has no cleaning and no inspection", async () => {
    mockTables({
      cleaning_records: { data: null, error: null },
      inspection_records: { data: null, error: null },
    });

    await expect(getSeatLastChecks("s-1")).resolves.toEqual({ last_cleaning: null, last_inspection: null });
  });

  it("should give null for a check that could not be read, never a pass", async () => {
    mockTables({
      cleaning_records: { data: null, error: new Error("db down") },
      inspection_records: { data: { created_at: "2026-10-24T09:45:00Z", result: "pass" }, error: null },
    });

    const result = await getSeatLastChecks("s-1");

    expect(result.last_cleaning).toBeNull();
    expect(result.last_inspection).not.toBeNull();
  });
});
