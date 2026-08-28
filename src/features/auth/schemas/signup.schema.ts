import { z } from "zod";

import { passwordSchema } from "@/lib/validation/password.schema";

/**
 * Intentionally has no `role` / `partner_id` field — those are assigned
 * server-side in `signup.action.ts` and must never come from the client.
 */
export const signupSchema = z
  .object({
    email: z.email("Enter a valid email address."),
    full_name: z.string().trim().min(1, "Full name is required."),
    password: passwordSchema,
    confirm_password: z.string().min(1, "Confirm your password."),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "Passwords do not match.",
    path: ["confirm_password"],
  });

export type SignupInput = z.infer<typeof signupSchema>;
