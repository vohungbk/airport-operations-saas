import { z } from "zod";

// z.guid(), not z.uuid(): seeded dev ids are not RFC-variant UUIDs.
const idField = (message: string) =>
  z.string().trim().min(1, message).pipe(z.guid(message));

export const NOTES_MAX_LENGTH = 1000;

export const startCleaningSchema = z.object({
  job_id: idField("Job not found."),
});

export type StartCleaningInput = z.infer<typeof startCleaningSchema>;

export const CLEANING_RESULTS = ["passed", "failed"] as const;

export const FAILED_NOTES_REQUIRED_MESSAGE = "Add notes when cleaning fails";

export const completeCleaningSchema = z
  .object({
    job_id: idField("Job not found."),
    result: z.enum(CLEANING_RESULTS, { error: "Choose the result." }),
    notes: z
      .string()
      .trim()
      .max(NOTES_MAX_LENGTH, `Notes must be at most ${NOTES_MAX_LENGTH} characters.`)
      .optional(),
  })
  // A failed cleaning keeps the seat out of use, so the reason must be written down.
  .superRefine((value, ctx) => {
    if (value.result === "failed" && !value.notes) {
      ctx.addIssue({
        code: "custom",
        path: ["notes"],
        message: FAILED_NOTES_REQUIRED_MESSAGE,
      });
    }
  });

export type CompleteCleaningInput = z.infer<typeof completeCleaningSchema>;
