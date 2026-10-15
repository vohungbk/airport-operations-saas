import { describe, expect, it } from "vitest";

import {
  getJobSearchError,
  JOB_SEARCH_MAX_LENGTH,
  JOB_SEARCH_TOO_LONG_MESSAGE,
} from "@/features/jobs/lib/job-search";
import { parseJobsQuery } from "@/features/jobs/schemas/jobs-query.schema";

const TECHNICIAN_ID = "d0000000-0000-0000-0000-000000000001";

describe("parseJobsQuery", () => {
  it("should apply defaults when no params are given", () => {
    const { query, search_error } = parseJobsQuery({});

    expect(search_error).toBeNull();
    expect(query).toEqual({
      q: undefined,
      status: undefined,
      technician_id: undefined,
      sort: "assigned_at",
      order: "desc",
      page: 1,
      page_size: 20,
    });
  });

  it("should accept a search value of exactly the maximum length", () => {
    const q = "a".repeat(JOB_SEARCH_MAX_LENGTH);

    const { query, search_error } = parseJobsQuery({ q });

    expect(search_error).toBeNull();
    expect(query.q).toBe(q);
  });

  it("should reject a search value one character over the maximum with a clear message", () => {
    const { query, search_error } = parseJobsQuery({
      q: "a".repeat(JOB_SEARCH_MAX_LENGTH + 1),
    });

    expect(search_error).toBe(JOB_SEARCH_TOO_LONG_MESSAGE);
    expect(query.q).toBeUndefined();
  });

  it("should accept a valid status and technician id", () => {
    const { query } = parseJobsQuery({
      status: "in_progress",
      technician_id: TECHNICIAN_ID,
    });

    expect(query.status).toBe("in_progress");
    expect(query.technician_id).toBe(TECHNICIAN_ID);
  });

  it("should drop an unknown status or malformed technician id instead of failing", () => {
    const { query } = parseJobsQuery({
      status: "paused",
      technician_id: "not-a-guid",
    });

    expect(query.status).toBeUndefined();
    expect(query.technician_id).toBeUndefined();
  });

  it("should fall back to defaults for an unknown sort column or bad page", () => {
    const { query } = parseJobsQuery({
      sort: "booking_id; drop table",
      page: "0",
      page_size: "5000",
    });

    expect(query.sort).toBe("assigned_at");
    expect(query.page).toBe(1);
    expect(query.page_size).toBe(20);
  });
});

describe("getJobSearchError", () => {
  it("should return null at the maximum length and ignore surrounding whitespace", () => {
    expect(
      getJobSearchError(` ${"a".repeat(JOB_SEARCH_MAX_LENGTH)} `),
    ).toBeNull();
  });
});
