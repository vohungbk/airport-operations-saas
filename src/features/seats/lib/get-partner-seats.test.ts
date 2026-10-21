import { describe, expect, it, vi } from "vitest";

import {
  PARTNER_SEAT_LIST_SELECT,
  getPartnerSeats,
} from "@/features/seats/lib/get-partner-seats";
import { partnerSeatsQuerySchema } from "@/features/seats/schemas/partner-seats-query.schema";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

type Answer = { data: unknown; count: number | null; error: { code?: string } | null };

/** A client whose request resolves to what `answer` gives for the call. */
function fakeClient(answer: (page: { from: number; to: number } | null) => Answer) {
  const calls: unknown[][] = [];
  const from = vi.fn((table: string) => {
    calls.push(["from", table]);
    let range: { from: number; to: number } | null = null;
    const query = {
      select: vi.fn((columns: string, options: unknown) => {
        calls.push(["select", columns, options]);
        return query;
      }),
      ilike: vi.fn((column: string, pattern: string) => {
        calls.push(["ilike", column, pattern]);
        return query;
      }),
      eq: vi.fn((column: string, value: string) => {
        calls.push(["eq", column, value]);
        return query;
      }),
      order: vi.fn(() => query),
      range: vi.fn((a: number, b: number) => {
        range = { from: a, to: b };
        return query;
      }),
      then: (resolve: (r: Answer) => void, reject: (e: unknown) => void) =>
        Promise.resolve(answer(range)).then(resolve, reject),
    };
    return query;
  });
  return { client: { from } as never, calls };
}

const query = (raw: Record<string, string> = {}) => partnerSeatsQuerySchema.parse(raw);

describe("getPartnerSeats", () => {
  it("should read only the serial number, status, category and airport of each seat", () => {
    expect(PARTNER_SEAT_LIST_SELECT).toBe(
      "id, serial_number, status, category:seat_categories(name), airport:airports(code, name)",
    );
    for (const hidden of [
      "public_token",
      "manufacturer",
      "model",
      "quarantine_reason",
      "rental_cycles",
      "purchase_date",
    ]) {
      expect(PARTNER_SEAT_LIST_SELECT).not.toContain(hidden);
    }
  });

  it("should return the page and the total, with no partner filter of its own (RLS is the scope)", async () => {
    const rows = [{ id: "s1", serial_number: "CS-1", status: "available" }];
    const { client, calls } = fakeClient(() => ({ data: rows, count: 1, error: null }));

    await expect(getPartnerSeats(query(), client)).resolves.toEqual({
      seats: rows,
      total: 1,
      page: 1,
    });
    expect(calls.filter((c) => c[0] === "eq" || c[0] === "ilike")).toEqual([]);
    expect(calls[0]).toEqual(["from", "seats"]);
  });

  it("should apply the search to the serial number and the status filter", async () => {
    const { client, calls } = fakeClient(() => ({ data: [], count: 0, error: null }));

    await getPartnerSeats(query({ q: "cs", status: "quarantine" }), client);

    expect(calls).toContainEqual(["ilike", "serial_number", "%cs%"]);
    expect(calls).toContainEqual(["eq", "status", "quarantine"]);
  });

  it("should serve the last valid page when the page asked for is past the end", async () => {
    const { client } = fakeClient((range) =>
      range?.from === 40
        ? { data: null, count: null, error: { code: "PGRST103" } }
        : range === null
          ? { data: null, count: 25, error: null }
          : { data: [{ id: "s9" }], count: 25, error: null },
    );

    const result = await getPartnerSeats(query({ page: "3" }), client);

    expect(result.page).toBe(2);
    expect(result.total).toBe(25);
    expect(result.seats).toEqual([{ id: "s9" }]);
  });

  it("should throw, not return an empty list, when the read fails", async () => {
    const { client } = fakeClient(() => ({ data: null, count: null, error: { code: "XX000" } }));

    await expect(getPartnerSeats(query(), client)).rejects.toMatchObject({ code: "XX000" });
  });
});
