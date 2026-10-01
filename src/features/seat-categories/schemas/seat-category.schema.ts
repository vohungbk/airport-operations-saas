import { z } from "zod";

/** Upper bound for child age in months (18 years). */
export const SEAT_CATEGORY_MAX_AGE_MONTHS = 216;

const nameField = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters.")
  .max(100, "Name must be at most 100 characters.");

/**
 * Empty/whitespace-only description is stored as `null`. Accepts `null`
 * on input because the client form submits the resolver's output, which
 * the Server Action then parses again.
 */
const descriptionField = z
  .string()
  .trim()
  .max(500, "Description must be at most 500 characters.")
  .nullish()
  .transform((value) => (value ? value : null));

const ageField = (label: string) =>
  z
    .number({ error: `${label} is required.` })
    .int(`${label} must be a whole number of months.`)
    .min(0, `${label} cannot be negative.`)
    .max(
      SEAT_CATEGORY_MAX_AGE_MONTHS,
      `${label} must be at most ${SEAT_CATEGORY_MAX_AGE_MONTHS} months.`,
    );

const safetyStandardField = z
  .string()
  .trim()
  .min(1, "Safety standard is required.")
  .max(200, "Safety standard must be at most 200 characters.");

const baseFields = {
  name: nameField,
  description: descriptionField,
  min_child_age: ageField("Minimum age"),
  max_child_age: ageField("Maximum age"),
  safety_standard: safetyStandardField,
};

/** Mirrors the DB's `seat_categories_age_range_check`. */
function refineAgeRange<
  T extends z.ZodType<{ min_child_age: number; max_child_age: number }>,
>(schema: T) {
  return schema.refine((value) => value.max_child_age >= value.min_child_age, {
    message: "Maximum age must be greater than or equal to minimum age.",
    path: ["max_child_age"],
  });
}

export const createSeatCategorySchema = refineAgeRange(
  z.object({ ...baseFields, is_active: z.boolean() }),
);

export type CreateSeatCategoryInput = z.infer<typeof createSeatCategorySchema>;

/**
 * No `id` and no `is_active` — the id comes from the route, and
 * activation is changed only through the dedicated set-active action.
 */
export const updateSeatCategorySchema = refineAgeRange(z.object(baseFields));

export type UpdateSeatCategoryInput = z.infer<typeof updateSeatCategorySchema>;

export const seatCategoryIdSchema = z.uuid();

export const setSeatCategoryActiveSchema = z.object({
  seat_category_id: z.uuid(),
  is_active: z.boolean(),
});

export type SetSeatCategoryActiveInput = z.infer<
  typeof setSeatCategoryActiveSchema
>;
