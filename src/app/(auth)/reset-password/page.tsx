import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TextLink } from "@/components/ui/text-link";
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
          <TextLink href="/forgot-password" className="text-sm">
            Request a new reset link
          </TextLink>
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
