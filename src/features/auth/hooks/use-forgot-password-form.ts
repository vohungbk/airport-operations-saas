"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { zodResolver } from "@/lib/validation/zod-resolver";
import {
  forgotPasswordAction,
  type ForgotPasswordActionResult,
} from "@/features/auth/actions/forgot-password.action";
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/features/auth/schemas/forgot-password.schema";

export function useForgotPasswordForm() {
  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ForgotPasswordActionResult | null>(
    null,
  );

  const onSubmit = form.handleSubmit((values) => {
    setResult(null);
    startTransition(async () => {
      setResult(await forgotPasswordAction(values));
    });
  });

  return { form, onSubmit, isPending, result };
}
