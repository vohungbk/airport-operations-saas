import { requireUser } from "@/lib/auth/session";
import { LogoutButton } from "@/features/auth/components/logout-button";

/**
 * Minimal landing page for the (dashboard) route group — a real redirect
 * destination for login/signup, not the Operations Dashboard (F19).
 */
export default async function DashboardPage() {
  const user = await requireUser();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        You&apos;re signed in
      </h1>
      <p className="text-sm text-muted-foreground">
        Signed in as {user.email ?? user.id}.
      </p>
      <LogoutButton />
    </div>
  );
}
