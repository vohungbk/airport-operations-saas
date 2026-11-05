import { PlaneIcon } from "lucide-react";

import {
  Card,
  CardContent,
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
    <>
      <header className="mb-8 flex flex-col gap-2 lg:absolute lg:top-8 lg:left-8 lg:mb-0">
        <h1 className="text-display font-semibold text-text">Sign in</h1>
        <p className="text-body text-text-muted">
          Secure access to Airport Operations SaaS
        </p>
      </header>

      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <PlaneIcon
            aria-hidden="true"
            strokeWidth={1.75}
            className="size-6 shrink-0 text-primary"
          />
          <p className="text-h2 font-semibold text-text">Airport Operations</p>
        </div>

        <Card className="gap-4 rounded-xl border border-border bg-surface py-5 ring-0">
          <CardHeader className="px-5">
            <CardTitle className="text-h3 font-semibold text-text">
              Sign in
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5">
            <LoginForm next={next} />
          </CardContent>
        </Card>

        <p className="text-body text-text-muted">
          Protected workspace · Tenant-scoped access · © 2026 Airport Operations
        </p>
      </div>
    </>
  );
}
