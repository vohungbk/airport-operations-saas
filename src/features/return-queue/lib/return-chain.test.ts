import { describe, expect, it } from "vitest";

import {
  buildChainProgress,
  chainStepNumber,
  currentStepLabel,
  queueStepOf,
} from "@/features/return-queue/lib/return-chain";

describe("return chain", () => {
  it.each([
    ["returned", "returned"],
    ["cleaning", "cleaning"],
    ["inspection", "final_inspection"],
  ] as const)(
    "should place a %s booking at the %s step",
    (status, step) => {
      expect(queueStepOf(status, "cleaning")).toBe(step);
    },
  );

  it("should place a quarantined seat in Quarantine and say which step failed", () => {
    expect(queueStepOf("inspection", "quarantine")).toBe("quarantine");
    expect(currentStepLabel("inspection", "quarantine")).toBe(
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
