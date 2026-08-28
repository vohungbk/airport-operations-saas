import { z } from "zod";

import { passwordSchema } from "@/lib/validation/password.schema";

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirm_password: z.string().min(1, "Confirm your password."),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "Passwords do not match.",
    path: ["confirm_password"],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
