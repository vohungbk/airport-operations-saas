import { requirePermission } from "@/lib/auth/current-user";
import { PageEmpty } from "@/components/shared/page-state";
import { FlightBoardBanners } from "@/features/flights/components/flight-board-banners";
import { FlightBoardFilters } from "@/features/flights/components/flight-board-filters";
import { FlightBoardTable } from "@/features/flights/components/flight-board-table";
import { FLIGHT_BOARD_LIMIT } from "@/features/flights/lib/flight-board";
import { getFlightBoard } from "@/features/flights/lib/get-flight-board";
import { flightBoardQuerySchema } from "@/features/flights/schemas/flight-board-query.schema";

interface FlightsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * VI-F02-S08 (spec S2, R3): the flights of today and after, at one airport, with how early or late each is.
 * A second `requirePermission` alongside the layout's (defense in depth). RLS decides which flights and
 * bookings the viewer sees. Loading is `loading.tsx`, the error state is `error.tsx`, and a role without
 * `dashboards:view` gets a 403 from the guard.
 */
export default async function FlightsPage({ searchParams }: FlightsPageProps) {
  await requirePermission("dashboards:view");

  const query = flightBoardQuerySchema.parse(await searchParams);
  const board = await getFlightBoard(query);

  return (
    <div className="flex flex-1 flex-col gap-4 p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Flight board</h1>
        {board.heading && <p className="text-sm text-muted-foreground">{board.heading}</p>}
      </div>

      <FlightBoardBanners alerts={board.alerts} />

      <FlightBoardFilters
        // The select keeps its own state; a new address starts it again from the values read on the server.
        key={`${board.airport?.id ?? ""}:${query.status ?? ""}`}
        query={{ ...query, airport_id: board.airport?.id }}
        airports={board.airports}
        sourceLabel={board.source_label}
        lastSyncLabel={board.last_sync_label}
      />

      {board.rows.length === 0 ? (
        <PageEmpty
          message={
            board.airport
              ? "No flights found. Try adjusting the filters."
              : "No airports found, so there are no flights to show."
          }
        />
      ) : (
        <>
          <FlightBoardTable rows={board.rows} />
          {board.truncated && (
            <p className="text-sm text-muted-foreground">
              {`Showing the first ${FLIGHT_BOARD_LIMIT} flights. Use the filters to narrow the list.`}
            </p>
          )}
        </>
      )}
    </div>
  );
}
