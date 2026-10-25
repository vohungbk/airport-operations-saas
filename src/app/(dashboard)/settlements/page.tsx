import { requireAnyPermission } from "@/lib/auth/current-user";
import { FINANCE_ACCESS_PERMISSIONS } from "@/lib/auth/permissions";
import { PageEmpty } from "@/components/shared/page-state";
import { GenerateSettlementForm } from "@/features/settlements/components/generate-settlement-form";
import { SettlementsTable } from "@/features/settlements/components/settlements-table";
import { getSettlementPartners } from "@/features/settlements/lib/get-settlement-partners";
import { getSettlements } from "@/features/settlements/lib/get-settlements";

/**
 * VI-F04-S12 (S4, R6, R7): the settlements in scope and, for an admin, the form that generates a
 * draft for a partner and a month. An admin, an operations manager (`finance:view`) and a partner
 * user (`finance:view_own_partner`) open it, checked here before anything is read; RLS decides
 * which settlements each one gets. Only an admin gets the form and the buttons that move a status: the Server Action and the database
 * function check the role again. This page itself writes nothing.
 */
export default async function SettlementsPage() {
  const user = await requireAnyPermission(FINANCE_ACCESS_PERMISSIONS);
  const canGenerate = user.role === "admin";

  const [settlements, partners] = await Promise.all([
    getSettlements(),
    canGenerate ? getSettlementPartners() : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Settlements</h1>
        <p className="text-sm text-muted-foreground">Monthly settlements of the partners.</p>
      </div>

      {canGenerate && (
        <section aria-labelledby="generate-heading" className="flex flex-col gap-3">
          <h2 id="generate-heading" className="text-lg font-medium text-foreground">
            Generate a settlement
          </h2>
          <GenerateSettlementForm partners={partners} />
        </section>
      )}

      <section aria-labelledby="settlements-heading" className="flex flex-col gap-3">
        <h2 id="settlements-heading" className="text-lg font-medium text-foreground">
          Settlements
        </h2>
        {settlements.length === 0 ? (
          <PageEmpty message="No settlements yet." />
        ) : (
          <SettlementsTable settlements={settlements} canMove={canGenerate} />
        )}
      </section>
    </div>
  );
}
