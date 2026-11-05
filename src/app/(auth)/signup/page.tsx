import { AuthPageFrame } from "@/features/auth/components/auth-page-frame";
import { SignupForm } from "@/features/auth/components/signup-form";

export default function SignupPage() {
  return (
    <AuthPageFrame title="Sign up">
      <SignupForm />
    </AuthPageFrame>
  );
}
