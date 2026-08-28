"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { zodResolver } from "@/lib/validation/zod-resolver";
import { loginAction } from "@/features/auth/actions/login.action";
import { loginSchema, type LoginInput } from "@/features/auth/schemas/login.schema";

export function useLoginForm() {
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = await loginAction(values);
      if (result?.error) {
        setFormError(result.error);
      }
    });
  });

  return { form, onSubmit, isPending, formError };
}
