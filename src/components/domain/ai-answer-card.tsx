import { ArrowDownIcon, ArrowUpIcon, LightbulbIcon, MinusIcon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  barPercent,
  blockHasData,
  formatChange,
  hasAnswerData,
  type AnswerBlock,
  type AnswerKpi,
  type ChangeDirection,
} from "@/lib/assistant/answer"
import { cn } from "@/lib/utils"

interface AiAnswerCardProps {
  question?: string
  blocks: readonly AnswerBlock[]
  /** The period the figures cover, already worded by the caller (for example `1 Oct to 31 Oct 2026`). */
  data_period?: string | null
  className?: string
}

/**
 * The answer of the assistant as text, table, chart, KPI comparison and recommendations, with the
 * data period (spec R8). It shows what it is given; with nothing to show it says so, never zeros (E5).
 */
function AiAnswerCard({ question, blocks, data_period, className }: AiAnswerCardProps) {
  const hasData = hasAnswerData(blocks)

  return (
    <Card data-slot="ai-answer-card" className={cn("min-w-0", className)}>
      <CardContent className="flex min-w-0 flex-col gap-4 text-sm">
        {question && <p className="min-w-0 break-words font-medium">{question}</p>}
        {hasData ? (
          blocks.map((block, index) => <Block key={index} block={block} />)
        ) : (
          <p data-slot="ai-answer-empty" className="text-muted-foreground">
            No data for this question.
          </p>
        )}
        {data_period && (
          <p data-slot="ai-answer-period" className="text-xs text-muted-foreground">
            Data period: {data_period}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function Block({ block }: { block: AnswerBlock }) {
  if (!blockHasData(block)) return null

  switch (block.type) {
    case "text":
      return <p className="min-w-0 whitespace-pre-line break-words">{block.text}</p>
    case "table":
      return (
        <Table>
          <TableHeader>
            <TableRow>
              {block.columns.map((column) => (
                <TableHead key={column}>{column}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {block.rows.map((row, rowIndex) => (
              <TableRow key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <TableCell key={cellIndex}>{cell}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )
    case "chart": {
      const max = Math.max(...block.bars.map((bar) => bar.value))
      return (
        <div data-slot="ai-answer-chart" className="flex min-w-0 flex-col gap-2">
          <h4 className="text-xs font-medium text-muted-foreground">{block.title}</h4>
          <ul className="flex min-w-0 flex-col gap-2">
            {block.bars.map((bar) => (
              <li key={bar.label} className="flex min-w-0 flex-col gap-1">
                <div className="flex min-w-0 items-baseline justify-between gap-2">
                  <span className="min-w-0 break-words">{bar.label}</span>
                  <span className="shrink-0 tabular-nums">{bar.value_text}</span>
                </div>
                <div aria-hidden="true" className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${barPercent(bar.value, max)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )
    }
    case "kpi":
      return (
        <ul data-slot="ai-answer-kpis" className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          {block.items.map((item) => (
            <Kpi key={item.label} item={item} />
          ))}
        </ul>
      )
    case "recommendations":
      return (
        <ul data-slot="ai-answer-recommendations" className="flex min-w-0 flex-col gap-1.5">
          {block.items.map((item, index) => (
            <li key={index} className="flex min-w-0 items-start gap-2">
              <LightbulbIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 break-words">{item}</span>
            </li>
          ))}
        </ul>
      )
  }
}

const CHANGE_ICON: Record<ChangeDirection, typeof ArrowUpIcon> = {
  up: ArrowUpIcon,
  down: ArrowDownIcon,
  flat: MinusIcon,
  unknown: MinusIcon,
}

const CHANGE_WORD: Record<ChangeDirection, string> = {
  up: "Up",
  down: "Down",
  flat: "No change",
  unknown: "No comparison",
}

function Kpi({ item }: { item: AnswerKpi }) {
  const change = formatChange(item.current, item.previous)
  const Icon = CHANGE_ICON[change.direction]

  return (
    <li data-slot="ai-answer-kpi" data-direction={change.direction} className="flex min-w-0 flex-col gap-0.5 rounded-lg border border-border p-3">
      <span className="text-xs text-muted-foreground">{item.label}</span>
      <span className="text-lg font-medium tabular-nums">{item.current_text}</span>
      <span className="flex flex-wrap items-center gap-1 text-xs tabular-nums text-muted-foreground">
        <Icon className="size-3.5 shrink-0" aria-hidden="true" />
        {CHANGE_WORD[change.direction]}
        {(change.direction === "up" || change.direction === "down") && ` ${change.text}`}
        {item.previous_text !== undefined && ` (was ${item.previous_text})`}
      </span>
    </li>
  )
}

export { AiAnswerCard }
export type { AiAnswerCardProps }
