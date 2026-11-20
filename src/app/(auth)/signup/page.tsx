import type { Metadata } from "next";

import { AuthPageFrame } from "@/features/auth/components/auth-page-frame";
import { SignupForm } from "@/features/auth/components/signup-form";

export const metadata: Metadata = { title: "Sign up" };

export default function SignupPage() {
  return (
    <AuthPageFrame title="Sign up">
      <SignupForm />
    </AuthPageFrame>
  );
}
