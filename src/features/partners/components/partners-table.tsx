import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PartnerStatusBadge } from "@/features/partners/components/partner-status-badge";
import type { Partner } from "@/features/partners/types";

interface PartnersTableProps {
  partners: Partner[];
}

const HEAD_CLASS = "h-11 px-6 text-xs font-medium text-text-muted";
const CELL_CLASS =
  "px-6 py-1 text-sm whitespace-normal break-words text-foreground";

/**
 * Server Component. The columns of the design: partner code (the link to the partner), partner name,
 * contact and status. The partners have no contact name yet, so the contact is the contact email. Below
 * 640 px the design is a list of cards (code, name, contact, status) instead of a table; the code link
 * stretches over the whole card so the card is the tap target.
 */
export function PartnersTable({ partners }: PartnersTableProps) {
  return (
    <>
      <ul className="flex flex-col gap-3 p-3 sm:hidden">
        {partners.map((partner) => (
          <li
            key={partner.id}
            className="relative flex flex-col items-start gap-1 rounded-lg border bg-card p-4"
          >
            <Link
              href={`/partners/${partner.id}`}
              aria-label={`View partner ${partner.name}`}
              className="text-xs font-medium text-primary after:absolute after:inset-0 hover:underline"
            >
              {partner.code}
            </Link>
            <p className="text-sm font-semibold break-words text-foreground">
              {partner.name}
            </p>
            <p className="text-xs break-words text-muted-foreground">
              Contact · {partner.contact_email ?? "—"}
            </p>
            <div className="mt-1">
              <PartnerStatusBadge status={partner.status} showDot />
            </div>
          </li>
        ))}
      </ul>
      <div className="hidden sm:block">
        <DesktopTable partners={partners} />
      </div>
    </>
  );
}

function DesktopTable({ partners }: PartnersTableProps) {
  return (
    <Table>
      <TableHeader className="bg-surface-muted">
        <TableRow className="hover:bg-transparent">
          <TableHead className={HEAD_CLASS}>Partner code</TableHead>
          <TableHead className={HEAD_CLASS}>Partner name</TableHead>
          <TableHead className={HEAD_CLASS}>Contact</TableHead>
          <TableHead className={HEAD_CLASS}>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {partners.map((partner) => (
          <TableRow key={partner.id} className="hover:bg-primary-subtle">
            <TableCell data-label="Partner code" className={CELL_CLASS}>
              <Link
                href={`/partners/${partner.id}`}
                aria-label={`View partner ${partner.name}`}
                className="inline-flex min-h-11 items-center font-medium text-primary hover:underline"
              >
                {partner.code}
              </Link>
            </TableCell>
            <TableCell
              data-label="Partner name"
              className={`${CELL_CLASS} font-semibold`}
            >
              {partner.name}
            </TableCell>
            <TableCell data-label="Contact" className={CELL_CLASS}>
              {partner.contact_email ?? "—"}
            </TableCell>
            <TableCell data-label="Status" className={CELL_CLASS}>
              <PartnerStatusBadge status={partner.status} showDot />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
