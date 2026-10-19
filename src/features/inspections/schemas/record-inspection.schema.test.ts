import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  INSPECTION_RESULTS,
  NOTES_MAX_LENGTH,
  recordInspectionSchema,
} from "@/features/inspections/schemas/record-inspection.schema";

const JOB_ID = "f0000000-0000-0000-0000-000000000002";
const SEAT_ID = "e0000000-0000-0000-0000-000000000002";
const valid = { job_id: JOB_ID, seat_id: SEAT_ID, result: "pass" as const };

describe("recordInspectionSchema", () => {
  it.each(INSPECTION_RESULTS.map((result) => [result]))(
    "should accept the result %s with no notes",
    (result) => {
      expect(
        recordInspectionSchema.safeParse({ ...valid, result }).success,
      ).toBe(true);
    },
  );

  it("should reject a missing result with a clear message", () => {
    const parsed = recordInspectionSchema.safeParse({
      job_id: JOB_ID,
      seat_id: SEAT_ID,
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0].message).toBe("Choose the result.");
  });

  it("should list exactly the values of the inspection_result enum in the migration", () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        "supabase/migrations/20260826083733_create_enums_and_extensions.sql",
      ),
      "utf8",
    );
    const body = /create type inspection_result as enum \(([^)]*)\)/.exec(sql);
    const values = [...(body?.[1] ?? "").matchAll(/'([^']+)'/g)].map((m) => m[1]);

    expect(values.length).toBeGreaterThan(0);
    expect([...INSPECTION_RESULTS]).toEqual(values);
  });

  it.each([[""], ["passed"], ["PASS"], ["maybe"], [" pass"], [null], [1]])(
    "should reject the result %j, which is outside the allowed list",
    (result) => {
      expect(
        recordInspectionSchema.safeParse({ ...valid, result }).success,
      ).toBe(false);
    },
  );

  it.each([[""], ["   "], ["not-a-uuid"]])(
    "should reject the seat %j with a clear message",
    (seat_id) => {
      const parsed = recordInspectionSchema.safeParse({ ...valid, seat_id });

      expect(parsed.success).toBe(false);
      expect(parsed.error?.issues[0].message).toBe("A seat is required.");
    },
  );

  it("should reject a bad job id", () => {
    expect(
      recordInspectionSchema.safeParse({ ...valid, job_id: "nope" }).success,
    ).toBe(false);
  });

  it("should trim the notes", () => {
    const parsed = recordInspectionSchema.parse({ ...valid, notes: "  Ok  " });

    expect(parsed.notes).toBe("Ok");
  });

  it("should accept notes of the maximum length and reject one more", () => {
    const ok = recordInspectionSchema.safeParse({
      ...valid,
      notes: "x".repeat(NOTES_MAX_LENGTH),
    });
    const tooLong = recordInspectionSchema.safeParse({
      ...valid,
      notes: "x".repeat(NOTES_MAX_LENGTH + 1),
    });

    expect(ok.success).toBe(true);
    expect(tooLong.success).toBe(false);
  });
});
