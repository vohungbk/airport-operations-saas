import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { ChartTable } from "@/lib/charts/chart-data"
import { cn } from "@/lib/utils"

interface ChartDataTableProps {
  table: ChartTable
  /** Names the table for a screen reader. */
  caption: string
  className?: string
}

/** The numbers of a chart, in full, as a table (spec R5, E3). A wide table scrolls inside its box, not the page. */
function ChartDataTable({ table, caption, className }: ChartDataTableProps) {
  return (
    <div data-slot="chart-data-table" className={cn("min-w-0 max-w-full overflow-x-auto", className)}>
      <Table>
        <caption className="sr-only">{caption}</caption>
        <TableHeader>
          <TableRow>
            {table.columns.map((column, index) => (
              <TableHead key={column} className={cn(index > 0 && "text-right")}>
                {column}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {table.rows.map((row) => (
            <TableRow key={row[0]}>
              {row.map((cell, index) => (
                <TableCell key={index} className={cn(index > 0 && "text-right tabular-nums")}>
                  {cell}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export { ChartDataTable }
export type { ChartDataTableProps }
