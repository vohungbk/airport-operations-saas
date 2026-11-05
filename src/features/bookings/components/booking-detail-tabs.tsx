"use client";

import { useState, type ReactNode } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getBookingPageTitle,
  resolveBookingPageTab,
  type BookingPageTab,
} from "@/features/bookings/lib/booking-tabs";

interface BookingDetailTabsProps {
  /** The tab that is open when the page loads. */
  defaultTab: BookingPageTab;
  subtitle: ReactNode;
  actions: ReactNode;
  overview: ReactNode;
  flight: ReactNode;
  timeline: ReactNode;
}

/** The tab of the design: a box with its own surface and a 2 px line below; the open one is blue. */
const TAB_CLASS =
  "mb-0 min-h-11 rounded-lg border-b-2 border-border bg-card px-4 py-3 text-sm font-normal data-active:border-primary data-active:bg-primary-subtle data-active:font-semibold data-active:text-primary";

/**
 * The heading and the tabs of the booking page. They share one piece of state because the heading names
 * the open tab (`Booking detail · Flight`); the content of each tab is built on the server and passed in.
 */
export function BookingDetailTabs({
  defaultTab,
  subtitle,
  actions,
  overview,
  flight,
  timeline,
}: BookingDetailTabsProps) {
  const [tab, setTab] = useState<BookingPageTab>(defaultTab);

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight break-words text-foreground">
            {getBookingPageTitle(tab)}
          </h1>
          {subtitle}
        </div>
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(resolveBookingPageTab(String(value)))}
      >
        <TabsList className="flex-wrap gap-3 overflow-visible border-b-0">
          <TabsTrigger value="overview" className={TAB_CLASS}>
            Overview
          </TabsTrigger>
          <TabsTrigger value="flight" className={TAB_CLASS}>
            Flight
          </TabsTrigger>
          <TabsTrigger value="timeline" className={TAB_CLASS}>
            Timeline
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="pt-4">
          {overview}
        </TabsContent>
        <TabsContent value="flight" className="pt-4">
          {flight}
        </TabsContent>
        <TabsContent value="timeline" className="pt-4">
          {timeline}
        </TabsContent>
      </Tabs>
    </div>
  );
}
