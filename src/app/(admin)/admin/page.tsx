import { requirePermission } from "@/lib/auth/current-user";

/**
 * Placeholder only — proves the `dashboards:view` guard works end to
 * end. Real admin/operations content is out of scope for F04.
 */
export default async function AdminPage() {
  const user = await requirePermission("dashboards:view");

  return (
    <div className="flex flex-1 flex-col gap-2 p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Admin Operations
      </h1>
      <p className="text-sm text-muted-foreground">
        Signed in as {user.email} (role: {user.role}).
      </p>
    </div>
  );
}
