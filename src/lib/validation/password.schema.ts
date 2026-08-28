import { z } from "zod";

/**
 * Minimum password length, matching the approved decision for F03: 8
 * characters, no forced special characters unless Supabase's own auth
 * config requires them. Kept as a single constant so the policy is a
 * one-line change if it ever needs to tighten.
 */
export const PASSWORD_MIN_LENGTH = 8;

export const passwordSchema = z
  .string()
  .min(
    PASSWORD_MIN_LENGTH,
    `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
  );
