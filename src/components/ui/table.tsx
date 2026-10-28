import * as React from "react";
import Link from "next/link";
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/*
 * `stacked` (UI-F06-S02, spec R10): on a phone (below `sm`) a wide table becomes a list of cards. Each
 * body row is a card, each cell shows its column name (`data-label` on the cell) in front of its value, and
 * the header shows only the columns that sort, as a row of links. From `sm` up it is the table it was.
 * The roles are written out because a table made of blocks loses its native roles in some browsers.
 */
interface TableProps extends React.ComponentProps<"table"> {
  stacked?: boolean;
}

function Table({ className, stacked = false, ...props }: TableProps) {
  return (
    <div
      data-slot="table-container"
      data-stacked={stacked ? "" : undefined}
      className="group/table relative w-full overflow-x-auto"
    >
      <table
        data-slot="table"
        role="table"
        className={cn(
          "w-full caption-bottom text-sm group-data-stacked/table:max-sm:block",
          className,
        )}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    // eslint-disable-next-line jsx-a11y/no-redundant-roles -- written out on purpose: a stacked table is made of blocks, and a browser can drop the native role
    <thead
      data-slot="table-header"
      role="rowgroup"
      className={cn(
        "[&_tr]:border-b group-data-stacked/table:max-sm:block group-data-stacked/table:max-sm:[&>tr]:flex group-data-stacked/table:max-sm:[&>tr]:flex-wrap group-data-stacked/table:max-sm:[&>tr]:items-center group-data-stacked/table:max-sm:[&>tr]:gap-1 group-data-stacked/table:max-sm:[&>tr]:border-b-0 group-data-stacked/table:max-sm:[&>tr]:pb-2 group-data-stacked/table:max-sm:[&>tr]:before:mr-1 group-data-stacked/table:max-sm:[&>tr]:before:text-xs group-data-stacked/table:max-sm:[&>tr]:before:text-muted-foreground group-data-stacked/table:max-sm:[&>tr]:before:content-['Sort_by']",
        className,
      )}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    // eslint-disable-next-line jsx-a11y/no-redundant-roles -- written out on purpose: a stacked table is made of blocks, and a browser can drop the native role
    <tbody
      data-slot="table-body"
      role="rowgroup"
      className={cn(
        "[&_tr:last-child]:border-0 group-data-stacked/table:max-sm:block group-data-stacked/table:max-sm:[&>tr]:mb-3 group-data-stacked/table:max-sm:[&>tr]:block group-data-stacked/table:max-sm:[&>tr]:rounded-lg group-data-stacked/table:max-sm:[&>tr]:border group-data-stacked/table:max-sm:[&>tr]:p-3 group-data-stacked/table:max-sm:[&_td]:flex group-data-stacked/table:max-sm:[&_td]:items-center group-data-stacked/table:max-sm:[&_td]:justify-between group-data-stacked/table:max-sm:[&_td]:gap-4 group-data-stacked/table:max-sm:[&_td]:px-0 group-data-stacked/table:max-sm:[&_td]:py-1.5 group-data-stacked/table:max-sm:[&_td]:text-right group-data-stacked/table:max-sm:[&_td]:break-words group-data-stacked/table:max-sm:[&_td]:whitespace-normal group-data-stacked/table:max-sm:[&_td]:before:shrink-0 group-data-stacked/table:max-sm:[&_td]:before:text-left group-data-stacked/table:max-sm:[&_td]:before:text-xs group-data-stacked/table:max-sm:[&_td]:before:text-muted-foreground group-data-stacked/table:max-sm:[&_td]:before:content-[attr(data-label)]",
        className,
      )}
      {...props}
    />
  );
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    // eslint-disable-next-line jsx-a11y/no-redundant-roles -- written out on purpose: a stacked table is made of blocks, and a browser can drop the native role
    <tfoot
      data-slot="table-footer"
      role="rowgroup"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className,
      )}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      role="row"
      className={cn(
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      role="columnheader"
      className={cn(
        "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground group-data-stacked/table:max-sm:hidden [&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  );
}

interface SortableTableHeadProps {
  href: string;
  label: string;
  /** The direction the table is sorted in by this column; `null` when it is sorted by another column. */
  direction: "asc" | "desc" | null;
  /** Draw a two-way arrow on a column that is not the one sorted by, so every head that sorts looks like one (the design of the bookings list). */
  idleIcon?: boolean;
  className?: string;
}

/**
 * The head of a column that sorts: a link to the same list sorted by it, 44 px high on a touch screen
 * (UI-F06-S02, spec R10), with `aria-sort` and an arrow that is not the only sign (the label says which
 * column). On a phone, where a table is cards, it stays visible so the list can still be sorted.
 */
function SortableTableHead({
  href,
  label,
  direction,
  idleIcon = false,
  className,
}: SortableTableHeadProps) {
  const Arrow =
    direction === "asc"
      ? ArrowUpIcon
      : direction === "desc"
        ? ArrowDownIcon
        : ArrowUpDownIcon;

  return (
    <TableHead
      aria-sort={
        direction === null
          ? undefined
          : direction === "asc"
            ? "ascending"
            : "descending"
      }
      className={cn("group-data-stacked/table:max-sm:block", className)}
    >
      <Link
        href={href}
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "-ml-2 font-medium",
        )}
      >
        {label}
        {(direction !== null || idleIcon) && <Arrow aria-hidden="true" />}
      </Link>
    </TableHead>
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      role="cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  );
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  SortableTableHead,
  TableRow,
  TableCell,
  TableCaption,
};
export type { SortableTableHeadProps, TableProps };
