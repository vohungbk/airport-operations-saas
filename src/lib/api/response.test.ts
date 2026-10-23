import { describe, expect, it } from "vitest";

import { apiError } from "@/lib/api/response";

describe("apiError", () => {
  it.each([
    ["VALIDATION_ERROR", 400],
    ["UNAUTHORIZED", 401],
    ["FORBIDDEN", 403],
    ["NOT_FOUND", 404],
    ["CONFLICT", 409],
    ["INTERNAL_ERROR", 500],
  ] as const)("should answer %s with status %i", async (code, status) => {
    const response = apiError(code, "Something");

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: { code, message: "Something" } });
  });

  it("should add the details only when there are some", async () => {
    const response = apiError("VALIDATION_ERROR", "Bad", [{ field: "id", issue: "Invalid" }]);

    expect(await response.json()).toEqual({
      error: { code: "VALIDATION_ERROR", message: "Bad", details: [{ field: "id", issue: "Invalid" }] },
    });
  });
});
