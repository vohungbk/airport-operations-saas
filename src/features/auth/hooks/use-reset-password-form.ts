"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { zodResolver } from "@/lib/validation/zod-resolver";
import { resetPasswordAction } from "@/features/auth/actions/reset-password.action";
import {
  resetPasswordSchema,
  type ResetPasswordInput,
} from "@/features/auth/schemas/reset-password.schema";

export function useResetPasswordForm() {
  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirm_password: "" },
  });
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = await resetPasswordAction(values);
      if (result?.error) {
        setFormError(result.error);
      }
    });
  });

  return { form, onSubmit, isPending, formError };
}
