import { beforeEach, describe, expect, it, vi } from "vitest";

import { findDuplicateSeatCategoryName } from "@/features/seat-categories/lib/find-duplicate-seat-category";

const limitMock = vi.hoisted(() => vi.fn());
const neqMock = vi.hoisted(() => vi.fn());
const ilikeMock = vi.hoisted(() => vi.fn());
const selectMock = vi.hoisted(() => vi.fn());
const fromMock = vi.hoisted(() => vi.fn());

function client() {
  return { from: fromMock } as unknown as Parameters<
    typeof findDuplicateSeatCategoryName
  >[0];
}

describe("findDuplicateSeatCategoryName", () => {
  beforeEach(() => {
    const chain = { neq: neqMock, limit: limitMock };
    limitMock.mockReset();
    neqMock.mockReset().mockReturnValue(chain);
    ilikeMock.mockReset().mockReturnValue(chain);
    selectMock.mockReset().mockReturnValue({ ilike: ilikeMock });
    fromMock.mockReset().mockReturnValue({ select: selectMock });
  });

  it("should report a duplicate when a row matches case-insensitively", async () => {
    limitMock.mockResolvedValue({ data: [{ id: "x" }], error: null });

    const result = await findDuplicateSeatCategoryName(client(), "booster");

    expect(result).toEqual({ duplicate: true });
    expect(fromMock).toHaveBeenCalledWith("seat_categories");
    expect(ilikeMock).toHaveBeenCalledWith("name", "booster");
    expect(neqMock).not.toHaveBeenCalled();
  });

  it("should escape ilike wildcards in the name", async () => {
    limitMock.mockResolvedValue({ data: [], error: null });

    await findDuplicateSeatCategoryName(client(), "100%_safe");

    expect(ilikeMock).toHaveBeenCalledWith("name", "100\\%\\_safe");
  });

  it("should exclude the given id so an update can keep its own name", async () => {
    limitMock.mockResolvedValue({ data: [], error: null });

    const result = await findDuplicateSeatCategoryName(client(), "x", "own-id");

    expect(result).toEqual({ duplicate: false });
    expect(neqMock).toHaveBeenCalledWith("id", "own-id");
  });

  it("should return the error when the query fails", async () => {
    const error = { code: "XX000", message: "boom" };
    limitMock.mockResolvedValue({ data: null, error });

    const result = await findDuplicateSeatCategoryName(client(), "x");

    expect(result).toEqual({ error });
  });
});
