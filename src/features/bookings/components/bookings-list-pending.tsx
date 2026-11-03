"use client";

import {
  createContext,
  startTransition as startPlainTransition,
  useContext,
  useMemo,
  useTransition,
  type ReactNode,
  type TransitionStartFunction,
} from "react";

import { BookingsTableSkeleton } from "@/features/bookings/components/bookings-table-skeleton";
import type { BookingsQuery } from "@/features/bookings/schemas/bookings-query.schema";

interface BookingsListPending {
  isPending: boolean;
  startTransition: TransitionStartFunction;
}

const BookingsListPendingContext = createContext<BookingsListPending>({
  isPending: false,
  startTransition: startPlainTransition,
});

/**
 * Shares one pending state between the filters (which start the navigation) and the results (which
 * show a skeleton until the server has sent the new list). It renders no element of its own.
 */
export function BookingsListPendingProvider({ children }: { children: ReactNode }) {
  const [isPending, startTransition] = useTransition();
  const value = useMemo(() => ({ isPending, startTransition }), [isPending, startTransition]);

  return <BookingsListPendingContext value={value}>{children}</BookingsListPendingContext>;
}

export function useBookingsListPending(): BookingsListPending {
  return useContext(BookingsListPendingContext);
}

/** The table (or the empty message), replaced by a skeleton while the list is being read. */
export function BookingsResults({ query, children }: { query: BookingsQuery; children?: ReactNode }) {
  const { isPending } = useBookingsListPending();

  return isPending ? <BookingsTableSkeleton query={query} /> : children;
}
