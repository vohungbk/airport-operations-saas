import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAuthUser } from "@/lib/auth/session";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";

export default async function ResetPasswordPage() {
  const user = await getAuthUser();

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Link invalid or expired</CardTitle>
          <CardDescription>
            This password reset link is no longer valid. Request a new one to
            continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/forgot-password"
            className="text-sm underline underline-offset-4 hover:text-foreground"
          >
            Request a new reset link
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reset your password</CardTitle>
        <CardDescription>Choose a new password for your account.</CardDescription>
      </CardHeader>
      <CardContent>
        <ResetPasswordForm />
      </CardContent>
    </Card>
  );
}
