import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "@/features/auth/components/login-form";
import { safeNextPath } from "@/lib/auth/safe-next-path";
import { RETURN_TO_PARAM } from "@/lib/constants/routes";

interface LoginPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * The page to return to after signing in comes from the address, so only a safe
 * path of this app is handed to the form (FO-F03-S11, spec E11); the action checks
 * it again before it redirects.
 */
export default async function LoginPage({ searchParams }: LoginPageProps) {
  const next = safeNextPath((await searchParams)[RETURN_TO_PARAM]) ?? undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>
          Sign in to your Airport Operations account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm next={next} />
      </CardContent>
    </Card>
  );
}
