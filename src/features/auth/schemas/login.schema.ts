import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
  /** The page to return to after signing in. Checked again on the server before it is used. */
  next: z.string().max(512).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
