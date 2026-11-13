import { describe, expect, it } from "vitest";

import { isQueueUnavailable } from "@/features/dashboard/lib/failed-queues";

describe("isQueueUnavailable (VI-F11-S13)", () => {
  it.each([
    ["Today's arrivals", { arrivalQueues: null }],
    ["Upcoming bookings", { arrivalQueues: null }],
    ["Seats requiring allocation", { allocationQueues: null }],
    ["Installations due", { allocationQueues: null }],
    ["Cleaning queue", { allocationQueues: null }],
    ["Inspection queue", { allocationQueues: null }],
    ["Active rentals", { activeReturned: null }],
    ["Returned seats", { activeReturned: null }],
    ["Damaged or quarantined", { quarantineQueue: null }],
    ["Technician assignments", { technicianAssignments: null }],
    ["Overdue tasks", { overdueList: null }],
    ["Open incidents", { openIncidents: null }],
  ])("should say %s is unavailable when its source failed", (queue, sources) => {
    expect(isQueueUnavailable(queue, sources)).toBe(true);
  });

  it("should keep a queue available when only another source failed", () => {
    expect(isQueueUnavailable("Open incidents", { overdueList: null })).toBe(false);
  });

  it("should not call a queue unavailable when its source was not given or is empty", () => {
    expect(isQueueUnavailable("Overdue tasks", {})).toBe(false);
    expect(isQueueUnavailable("Overdue tasks", { overdueList: { count: 0, items: [] } })).toBe(false);
  });

  it("should not call a name that is not a queue unavailable", () => {
    expect(isQueueUnavailable("Something else", { overdueList: null })).toBe(false);
  });
});
