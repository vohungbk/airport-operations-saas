import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, ShieldCheck } from "lucide-react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ImportBookingsScreenProps {
  children: ReactNode;
}

const TAB_CLASS =
  "rounded-md border-b-0 px-3 data-active:bg-accent data-active:text-accent-foreground";

/**
 * CO-F07-S01 (design "Import bookings"): the frame of the screen, the path, the title, the two tabs,
 * the card of the current state and the note at the bottom. The tab "Import history" belongs to its
 * own story, so it is shown but cannot be opened yet.
 */
export function ImportBookingsScreen({ children }: ImportBookingsScreenProps) {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-8">
      <div className="flex flex-col gap-2">
        <nav aria-label="Path" className="flex items-center gap-1 text-xs text-muted-foreground">
          <Link href="/bookings" className="rounded-sm hover:text-foreground">
            Bookings
          </Link>
          <ChevronRight className="size-3" aria-hidden="true" />
          <span aria-current="page" className="text-foreground">
            Import
          </span>
        </nav>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Import bookings
        </h1>
        <p className="text-sm text-muted-foreground">
          Upload a partner CSV, review the validation report, then confirm your import.
        </p>
      </div>

      <Tabs defaultValue="import">
        <TabsList>
          <TabsTrigger value="import" className={TAB_CLASS}>
            Import bookings
          </TabsTrigger>
          <TabsTrigger value="history" disabled className={TAB_CLASS}>
            Import history
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {children}

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="size-3.5 shrink-0" aria-hidden="true" />
        Bookings are only created after you confirm the import.
      </p>
    </div>
  );
}
