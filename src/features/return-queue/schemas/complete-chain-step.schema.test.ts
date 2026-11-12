import { describe, expect, it } from "vitest";

import {
  CHECKLIST_REQUIRED_MESSAGE,
  NOTES_REQUIRED_ON_FAIL_MESSAGE,
  PHOTO_REQUIRED_MESSAGE,
  completeChainStepSchema,
} from "@/features/return-queue/schemas/complete-chain-step.schema";

const BOOKING_ID = "b0000000-0000-0000-0000-000000000123";

const VALID = {
  booking_id: BOOKING_ID,
  step: "cleaning",
  result: "pass",
  checklist: { shell_cleaned: true, harness_cleaned: true, straps_cleaned: true },
  notes: "",
  photo_paths: [`${BOOKING_ID}/cleaning/p-1.jpg`],
};

function issueAt(input: Record<string, unknown>, field: string) {
  const parsed = completeChainStepSchema.safeParse({ ...VALID, ...input });

  return parsed.success
    ? undefined
    : parsed.error.issues.find((issue) => issue.path[0] === field)?.message;
}

describe("completeChainStepSchema", () => {
  it("should accept a step with every item ticked, a result and a photo", () => {
    expect(completeChainStepSchema.safeParse(VALID).success).toBe(true);
  });

  it("should accept a Fail with notes", () => {
    expect(
      completeChainStepSchema.safeParse({ ...VALID, result: "fail", notes: "Torn strap" }).success,
    ).toBe(true);
  });

  it.each([
    ["an unticked item", { checklist: { shell_cleaned: true, harness_cleaned: true, straps_cleaned: false } }],
    ["a missing item", { checklist: { shell_cleaned: true } }],
  ])("should reject a checklist with %s", (_name, input) => {
    expect(issueAt(input, "checklist")).toBe(CHECKLIST_REQUIRED_MESSAGE);
  });

  it("should reject a Fail without notes", () => {
    expect(issueAt({ result: "fail", notes: "   " }, "notes")).toBe(NOTES_REQUIRED_ON_FAIL_MESSAGE);
  });

  it.each([
    ["no photo", []],
    ["a photo of another step", [`${BOOKING_ID}/drying/p-1.jpg`]],
    ["a photo outside the step folder", [`${BOOKING_ID}/cleaning/../other/p-1.jpg`]],
  ])("should reject %s", (_name, photo_paths) => {
    expect(issueAt({ photo_paths }, "photo_paths")).toBe(PHOTO_REQUIRED_MESSAGE);
  });

  it("should reject a missing result", () => {
    expect(issueAt({ result: undefined }, "result")).toBe("Choose the result.");
  });
});
