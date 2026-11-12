import { z } from "zod";

import {
  RECORDED_CHAIN_STEPS,
  RETURN_CHAIN_CHECKLIST,
  type ChainStepResult,
} from "@/features/return-queue/lib/return-chain";

const CHAIN_STEP_NOTES_MAX_LENGTH = 1000;

export const CHAIN_STEP_RESULTS = ["pass", "fail"] as const satisfies readonly ChainStepResult[];

export const CHAIN_STEP_RESULT_LABEL: Record<ChainStepResult, string> = {
  pass: "Pass",
  fail: "Fail",
};

export const CHECKLIST_REQUIRED_MESSAGE = "Answer every checklist item.";
export const NOTES_REQUIRED_ON_FAIL_MESSAGE = "Add notes when the result is Fail.";
export const PHOTO_REQUIRED_MESSAGE = "Add a photo of this step.";

/**
 * Complete a step of the return chain (FO-F08-S02, V1 to V4). The same schema
 * runs in the form and in the Server Action; complete_return_chain_step()
 * checks the same rules again in the database.
 */
export const completeChainStepSchema = z
  .object({
    // z.guid(), not z.uuid(): seeded dev ids are not RFC-variant UUIDs.
    booking_id: z.guid("Booking not found."),
    step: z.enum(RECORDED_CHAIN_STEPS, { error: "This step cannot be recorded." }),
    result: z.enum(CHAIN_STEP_RESULTS, { error: "Choose the result." }),
    checklist: z.record(z.string(), z.boolean()),
    notes: z
      .string()
      .trim()
      .max(
        CHAIN_STEP_NOTES_MAX_LENGTH,
        `Notes must be at most ${CHAIN_STEP_NOTES_MAX_LENGTH} characters.`,
      ),
    photo_paths: z.array(z.string().min(1)).min(1, PHOTO_REQUIRED_MESSAGE),
  })
  .superRefine((value, ctx) => {
    const unanswered = RETURN_CHAIN_CHECKLIST[value.step].some(
      (item) => value.checklist[item.id] !== true,
    );

    if (unanswered) {
      ctx.addIssue({ code: "custom", path: ["checklist"], message: CHECKLIST_REQUIRED_MESSAGE });
    }

    if (value.result === "fail" && !value.notes) {
      ctx.addIssue({ code: "custom", path: ["notes"], message: NOTES_REQUIRED_ON_FAIL_MESSAGE });
    }

    // A photo must sit under the folder of this booking and step.
    const folder = `${value.booking_id}/${value.step}/`;

    if (value.photo_paths.some((path) => !path.startsWith(folder) || path.includes("..", folder.length))) {
      ctx.addIssue({ code: "custom", path: ["photo_paths"], message: PHOTO_REQUIRED_MESSAGE });
    }
  });

export type CompleteChainStepInput = z.infer<typeof completeChainStepSchema>;
