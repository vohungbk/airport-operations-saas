import type { Metadata } from "next";

import { AuthPageFrame } from "@/features/auth/components/auth-page-frame";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <AuthPageFrame title="Forgot password">
      <ForgotPasswordForm />
    </AuthPageFrame>
  );
}
