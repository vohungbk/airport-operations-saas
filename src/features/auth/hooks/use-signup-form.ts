"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { zodResolver } from "@/lib/validation/zod-resolver";
import {
  signupAction,
  type SignupActionResult,
} from "@/features/auth/actions/signup.action";
import {
  signupSchema,
  type SignupInput,
} from "@/features/auth/schemas/signup.schema";

export function useSignupForm() {
  const form = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: "",
      full_name: "",
      password: "",
      confirm_password: "",
    },
  });
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<SignupActionResult | null>(null);

  const onSubmit = form.handleSubmit((values) => {
    setResult(null);
    startTransition(async () => {
      setResult(await signupAction(values));
    });
  });

  return { form, onSubmit, isPending, result };
}
