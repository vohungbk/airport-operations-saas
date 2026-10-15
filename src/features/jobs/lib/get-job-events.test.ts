import { beforeEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({
  table: "",
  eq: [] as Array<[string, unknown]>,
  limit: 0,
  result: { data: null as unknown, error: null as unknown },
}));

function builder() {
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.order = () => chain;
  chain.eq = (column: string, value: unknown) => {
    calls.eq.push([column, value]);
    return chain;
  };
  chain.limit = (value: number) => {
    calls.limit = value;
    return chain;
  };
  chain.then = (resolve: (value: unknown) => unknown) => resolve(calls.result);
  return chain;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: (table: string) => {
      calls.table = table;
      return builder();
    },
  })),
}));

import {
  JOB_EVENTS_LIMIT,
  getJobEvents,
} from "@/features/jobs/lib/get-job-events";

const JOB_ID = "f0000000-0000-0000-0000-000000000002";

describe("getJobEvents", () => {
  beforeEach(() => {
    calls.table = "";
    calls.eq = [];
    calls.limit = 0;
    calls.result = { data: [], error: null };
  });

  it("should return nothing and skip the query for a malformed id", async () => {
    expect(await getJobEvents("not-an-id")).toEqual({
      events: [],
      truncated: false,
    });
    expect(calls.table).toBe("");
  });

  it("should query the job's events with a limit", async () => {
    await getJobEvents(JOB_ID);

    expect(calls.table).toBe("technician_job_events");
    expect(calls.eq).toContainEqual(["technician_job_id", JOB_ID]);
    expect(calls.limit).toBe(JOB_EVENTS_LIMIT + 1);
  });

  it("should flag status and assignee changes and fall back when names are hidden", async () => {
    calls.result = {
      data: [
        {
          id: "e-1",
          from_status: "assigned",
          to_status: "in_progress",
          from_technician_id: "t-1",
          to_technician_id: "t-1",
          notes: null,
          created_at: "2026-10-16T08:00:00Z",
          actor: null,
          from_technician: null,
          to_technician: null,
        },
        {
          id: "e-2",
          from_status: "in_progress",
          to_status: "in_progress",
          from_technician_id: "t-1",
          to_technician_id: "t-2",
          notes: null,
          created_at: "2026-10-16T09:00:00Z",
          actor: { full_name: "Ops" },
          from_technician: { full_name: "A" },
          to_technician: { full_name: "B" },
        },
      ],
      error: null,
    };

    const { events } = await getJobEvents(JOB_ID);

    expect(events[0]).toMatchObject({
      status_changed: true,
      technician_changed: false,
      actor_name: null,
    });
    expect(events[1]).toMatchObject({
      status_changed: false,
      technician_changed: true,
      to_technician_name: "B",
      actor_name: "Ops",
    });
  });

  it("should flag truncation only when more than the limit was returned", async () => {
    const row = {
      id: "e",
      from_status: "assigned",
      to_status: "in_progress",
      from_technician_id: "t",
      to_technician_id: "t",
      notes: null,
      created_at: "2026-10-16T08:00:00Z",
      actor: null,
      from_technician: null,
      to_technician: null,
    };

    calls.result = {
      data: Array.from({ length: JOB_EVENTS_LIMIT }, () => row),
      error: null,
    };
    expect((await getJobEvents(JOB_ID)).truncated).toBe(false);

    calls.result = {
      data: Array.from({ length: JOB_EVENTS_LIMIT + 1 }, () => row),
      error: null,
    };
    const result = await getJobEvents(JOB_ID);
    expect(result.truncated).toBe(true);
    expect(result.events).toHaveLength(JOB_EVENTS_LIMIT);
  });

  it("should throw when the query fails", async () => {
    calls.result = { data: null, error: new Error("boom") };

    await expect(getJobEvents(JOB_ID)).rejects.toThrow("boom");
  });
});
