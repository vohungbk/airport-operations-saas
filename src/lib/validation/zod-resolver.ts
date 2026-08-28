import type { FieldErrors, FieldValues, Resolver } from "react-hook-form";
import type { ZodType } from "zod";

/**
 * Minimal react-hook-form `Resolver` adapter for a Zod schema.
 * `@hookform/resolvers` is not an installed dependency (`CLAUDE.md`: no
 * unnecessary dependencies) — this is the small amount of glue needed to
 * wire an existing `zod` schema into `useForm({ resolver })` without it.
 */
export function zodResolver<TFieldValues extends FieldValues>(
  schema: ZodType<TFieldValues>,
): Resolver<TFieldValues> {
  return async (values) => {
    const result = schema.safeParse(values);

    if (result.success) {
      return { values: result.data, errors: {} };
    }

    const errors: Record<string, { type: string; message: string }> = {};

    for (const issue of result.error.issues) {
      const path = issue.path.join(".");
      if (!errors[path]) {
        errors[path] = { type: issue.code, message: issue.message };
      }
    }

    return { values: {}, errors: errors as FieldErrors<TFieldValues> };
  };
}
