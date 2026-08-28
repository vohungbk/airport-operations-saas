import { requirePermission } from "@/lib/auth/current-user";

/**
 * Placeholder only — proves the `bookings:view_own_partner` guard works
 * end to end and demonstrates the partner-isolation pattern every real
 * partner-scoped query in this area must follow later: `partner_id ===
 * null` means "no partner assigned yet" (safe empty state), never
 * "unrestricted / see everyone". No Supabase table query happens here —
 * no partner/booking CRUD is in scope for F04.
 */
export default async function PartnerPage() {
  const user = await requirePermission("bookings:view_own_partner");

  return (
    <div className="flex flex-1 flex-col gap-2 p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Partner Portal
      </h1>
      <p className="text-sm text-muted-foreground">
        Signed in as {user.email} (role: {user.role}).
      </p>
      {user.partner_id ? (
        <p className="text-sm text-muted-foreground">
          Partner: {user.partner_id}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          No partner is assigned to this account yet. Contact your
          administrator to get access to partner data.
        </p>
      )}
    </div>
  );
}
