import { requirePermission } from "@/lib/auth/current-user";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageEmpty } from "@/components/shared/page-state";
import { BackToPartnerHome } from "@/features/partners/components/back-to-partner-home";
import { PartnerSeatsFilters } from "@/features/seats/components/partner-seats-filters";
import { PartnerSeatsPagination } from "@/features/seats/components/partner-seats-pagination";
import { PartnerSeatsTable } from "@/features/seats/components/partner-seats-table";
import { getPartnerSeats } from "@/features/seats/lib/get-partner-seats";
import { partnerSeatsQuerySchema } from "@/features/seats/schemas/partner-seats-query.schema";

interface PartnerSeatsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function Heading() {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Seats
      </h1>
      <p className="text-sm text-muted-foreground">
        The seats on your organization&apos;s bookings, and their status. Read
        only.
      </p>
    </div>
  );
}

/**
 * The partner seats view (VI-F03-S04). `seats:view_own_partner` is guarded
 * here and `bookings:view_own_partner` by the layout. The scope is never taken
 * from the address: RLS gives a partner user only the seats assigned to a
 * booking of their own partner, and the query schema has no partner, airport
 * or category key. An account with no partner reads nothing and says so
 * (spec E2). A failed read is thrown to the error boundary, never shown as an
 * empty list.
 */
export default async function PartnerSeatsPage({
  searchParams,
}: PartnerSeatsPageProps) {
  const user = await requirePermission("seats:view_own_partner");

  if (user.partner_id === null) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-8">
        <div>
          <BackToPartnerHome />
        </div>
        <Heading />
        <Alert>
          <AlertTitle>Your account is not linked to a partner yet</AlertTitle>
          <AlertDescription>
            There is nothing to show until it is linked. Ask an administrator
            to link your account to your partner.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const requestedQuery = partnerSeatsQuerySchema.parse(await searchParams);
  const { seats, total, page } = await getPartnerSeats(requestedQuery);
  // An out-of-range page is served as the last valid page.
  const query = { ...requestedQuery, page };
  const isFiltered = Boolean(query.q || query.status);

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <div>
        <BackToPartnerHome />
      </div>
      <Heading />

      <PartnerSeatsFilters query={query} />

      {total === 0 ? (
        <PageEmpty
          message={
            isFiltered
              ? "No seats found. Try adjusting the search or the status."
              : "No seats yet. Seats appear here once they are assigned to one of your bookings."
          }
        />
      ) : (
        <>
          <PartnerSeatsTable seats={seats} query={query} />
          <PartnerSeatsPagination query={query} total={total} />
        </>
      )}
    </div>
  );
}
