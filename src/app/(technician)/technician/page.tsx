import { requirePermission } from "@/lib/auth/current-user";

/**
 * Placeholder only — proves the `jobs:view_assigned` guard works end to
 * end. Real technician workflow content is out of scope for F04.
 */
export default async function TechnicianPage() {
  const user = await requirePermission("jobs:view_assigned");

  return (
    <div className="flex flex-1 flex-col gap-2 p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Technician Jobs
      </h1>
      <p className="text-sm text-muted-foreground">
        Signed in as {user.email} (role: {user.role}).
      </p>
    </div>
  );
}
