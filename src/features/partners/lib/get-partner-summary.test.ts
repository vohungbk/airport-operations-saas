import { describe, expect, it, vi } from "vitest";

import { getPartnerSummary } from "@/features/partners/lib/get-partner-summary";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

function fakeClient(answer: { data: unknown; error: unknown }) {
  const calls: unknown[] = [];
  const query = {
    select: vi.fn((columns: string) => {
      calls.push(["select", columns]);
      return query;
    }),
    eq: vi.fn((column: string, value: string) => {
      calls.push(["eq", column, value]);
      return query;
    }),
    maybeSingle: vi.fn(async () => answer),
  };
  return { client: { from: vi.fn(() => query) } as never, calls };
}

describe("getPartnerSummary", () => {
  it("should read only the name and code of the given partner", async () => {
    const { client, calls } = fakeClient({
      data: { name: "ERAC Rentals", code: "ERAC" },
      error: null,
    });

    await expect(getPartnerSummary("partner-a", client)).resolves.toEqual({
      name: "ERAC Rentals",
      code: "ERAC",
    });
    expect(calls).toEqual([
      ["select", "name, code"],
      ["eq", "id", "partner-a"],
    ]);
  });

  it("should return null when the partner is not visible to the caller", async () => {
    const { client } = fakeClient({ data: null, error: null });

    await expect(getPartnerSummary("partner-b", client)).resolves.toBeNull();
  });

  it("should throw a generic error, not null, when the read fails", async () => {
    const { client } = fakeClient({
      data: null,
      error: { message: "connection to db.internal:5432 refused" },
    });

    await expect(getPartnerSummary("partner-a", client)).rejects.toThrow(
      "Could not read the partner",
    );
    await expect(getPartnerSummary("partner-a", client)).rejects.not.toThrow(
      /db\.internal/,
    );
  });
});
