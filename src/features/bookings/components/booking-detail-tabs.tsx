"use client";

import { useState, type ReactNode } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getBookingPageTitle,
  getBookingTabBar,
  resolveBookingPageTab,
  resolveOpenTab,
  type BookingPageTab,
} from "@/features/bookings/lib/booking-tabs";

interface BookingDetailTabsProps {
  /** The tab that is open when the page loads. */
  defaultTab: BookingPageTab;
  /** The Revenue tab is for the roles that may see the revenue. */
  canViewRevenue: boolean;
  subtitle: ReactNode;
  /** The status and step badges, at the right of the heading. */
  badges: ReactNode;
  actions: ReactNode;
  overview: ReactNode;
  flight: ReactNode;
  /** The revenue of the booking; shown only when `canViewRevenue`. */
  revenue: ReactNode;
  timeline: ReactNode;
  photos: ReactNode;
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
  canViewRevenue,
  subtitle,
  badges,
  actions,
  overview,
  flight,
  revenue,
  timeline,
  photos,
}: BookingDetailTabsProps) {
  const [tab, setTab] = useState<BookingPageTab>(resolveOpenTab(defaultTab, canViewRevenue));

  function handleTabChange(value: unknown) {
    setTab(resolveBookingPageTab(String(value)));
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight break-words text-foreground">
            {getBookingPageTitle(tab)}
          </h1>
          {subtitle}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {badges}
          {actions}
        </div>
      </div>

      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList className="gap-3 overflow-x-auto border-b-0 pb-1">
          {getBookingTabBar(canViewRevenue).map((item) => (
            <TabsTrigger key={item.value} value={item.value} className={TAB_CLASS}>
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="pt-4">
          {overview}
        </TabsContent>
        <TabsContent value="flight" className="pt-4">
          {flight}
        </TabsContent>
        {canViewRevenue && (
          <TabsContent value="revenue" className="pt-4">
            {revenue}
          </TabsContent>
        )}
        <TabsContent value="timeline" className="pt-4">
          {timeline}
        </TabsContent>
        <TabsContent value="photos" className="pt-4">
          {photos}
        </TabsContent>
      </Tabs>
    </div>
  );
}
