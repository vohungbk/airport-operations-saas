import { describe, expect, it } from "vitest";

import {
  buildChainProgress,
  chainStepNumber,
  currentChainStep,
  currentStepLabel,
  queueStepOf,
  type RecordedChainStepRow,
} from "@/features/return-queue/lib/return-chain";

const AT = "2026-11-04T06:00:00Z";

describe("return chain", () => {
  it.each([
    ["returned", "returned"],
    ["cleaning", "cleaning"],
    ["inspection", "final_inspection"],
  ] as const)(
    "should place a %s booking at the %s step",
    (status, step) => {
      expect(currentChainStep(status, [])).toBe(step);
    },
  );

  it.each<[string, "returned" | "cleaning" | "inspection", RecordedChainStepRow[], string]>([
    ["the step after the last recorded one", "returned", [
      { step: "returned", result: "pass", completed_at: AT },
      { step: "initial_inspection", result: "pass", completed_at: AT },
    ], "cleaning"],
    ["the step of the booking status when it is further on", "inspection", [
      { step: "returned", result: "pass", completed_at: AT },
    ], "final_inspection"],
    ["the failed step, where the chain stops", "returned", [
      { step: "returned", result: "pass", completed_at: AT },
      { step: "initial_inspection", result: "fail", completed_at: AT },
    ], "initial_inspection"],
    ["Available after the final inspection passes", "inspection", [
      { step: "final_inspection", result: "pass", completed_at: AT },
    ], "available"],
  ])("should place the booking at %s", (_name, status, recorded, step) => {
    expect(currentChainStep(status, recorded)).toBe(step);
  });

  it("should place a quarantined seat in Quarantine and say which step failed", () => {
    expect(queueStepOf("final_inspection", "quarantine")).toBe("quarantine");
    expect(currentStepLabel("final_inspection", "quarantine")).toBe(
      "Final inspection failed",
    );
  });

  it("should mark the steps before the current one done and the ones after locked", () => {
    const states = buildChainProgress("cleaning", false).map((s) => s.state);

    expect(states).toEqual([
      "completed",
      "completed",
      "current",
      "locked",
      "locked",
      "locked",
      "locked",
    ]);
    expect(chainStepNumber("cleaning")).toBe(3);
  });

  it("should mark the current step failed for a quarantined seat", () => {
    const step = buildChainProgress("final_inspection", true)[5];

    expect(step).toMatchObject({ label: "Final inspection", state: "failed" });
  });
});
