import { AuthPageFrame } from "@/features/auth/components/auth-page-frame";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <AuthPageFrame title="Forgot password">
      <ForgotPasswordForm />
    </AuthPageFrame>
  );
}
