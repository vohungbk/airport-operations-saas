import { requireAnyPermission } from "@/lib/auth/current-user";
import { FINANCE_ACCESS_PERMISSIONS } from "@/lib/auth/permissions";
import { formatZoneHeader } from "@/features/flights/lib/flight-board";
import { getDefaultSimulatorAirport } from "@/features/flights/lib/simulator-lookup";
import { formatDate } from "@/features/jobs/lib/job-time";
import { GenerateSettlementDialog } from "@/features/settlements/components/generate-settlement-dialog";
import { SettlementsFilters } from "@/features/settlements/components/settlements-filters";
import { SettlementsRegister } from "@/features/settlements/components/settlements-register";
import { getSettlementPartners } from "@/features/settlements/lib/get-settlement-partners";
import { getSettlements } from "@/features/settlements/lib/get-settlements";
import {
  resolveSettlementsQuery,
  settlementsQuerySchema,
} from "@/features/settlements/schemas/settlements-query.schema";

interface SettlementsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * VI-F04-S12 (S4, R6, R7): the settlements in scope, with filters and pages, and, for an admin, the
 * Generate settlement button that opens the form of a draft for a partner and a month. An admin, an
 * operations manager (`finance:view`) and a partner user (`finance:view_own_partner`) open it, checked
 * here before anything is read; RLS decides which settlements each one gets. Only an admin gets the
 * button: the Server Action and the database function check the role again. The buttons that move a status
 * are not on this list (the design has none); they come with the settlement detail screen. This page itself writes nothing.
 */
export default async function SettlementsPage({ searchParams }: SettlementsPageProps) {
  const user = await requireAnyPermission(FINANCE_ACCESS_PERMISSIONS);
  const canGenerate = user.role === "admin";
  const isPartner = user.role === "partner_user";
  const now = new Date();

  const query = resolveSettlementsQuery(settlementsQuerySchema.parse(await searchParams), isPartner);
  const [result, partners, airport] = await Promise.all([
    getSettlements(query),
    isPartner ? Promise.resolve([]) : getSettlementPartners(),
    getDefaultSimulatorAirport(),
  ]);
  // A page past the last one is served as the last page.
  const current = { ...query, page: result.page };

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Settlements</h1>
          {airport && (
            <p className="text-sm text-muted-foreground">
              {`${airport.code} · ${formatDate(now, airport.timezone)} · ${formatZoneHeader(airport.timezone, now)}`}
            </p>
          )}
        </div>
        {canGenerate && <GenerateSettlementDialog partners={partners} />}
      </div>

      <SettlementsFilters query={current} partners={partners} />

      <SettlementsRegister settlements={result.settlements} total={result.total} query={current} />
    </div>
  );
}
