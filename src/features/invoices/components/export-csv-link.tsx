import { Download } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";

interface ExportCsvLinkProps {
  /** The address of the export, which holds the filters and the sort of the list on the screen. */
  href: string;
}

/** The Export CSV button of the design: a link that downloads, so it needs no client JS. */
export function ExportCsvLink({ href }: ExportCsvLinkProps) {
  return (
    <a href={href} download className={buttonVariants({ variant: "outline", className: "min-h-11 px-4" })}>
      <Download aria-hidden="true" />
      Export CSV
    </a>
  );
}
