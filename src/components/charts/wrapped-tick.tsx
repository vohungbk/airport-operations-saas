import { LABEL_LINE_HEIGHT, LABEL_MAX_CHARS, wrapLabel } from "@/lib/charts/bar-data"

interface WrappedTickProps {
  /** Set by the chart library when it draws the tick. */
  x?: number
  y?: number
  payload?: { value?: string | number }
  max_chars?: number
}

/**
 * The name of a category at the left of its bar, wrapped onto lines so a long name is not cut or
 * pushed out of the chart (spec E2). It takes the color of the text, not of a series.
 */
function WrappedTick({ x = 0, y = 0, payload, max_chars = LABEL_MAX_CHARS }: WrappedTickProps) {
  const lines = wrapLabel(String(payload?.value ?? ""), max_chars)
  const top = y - ((lines.length - 1) * LABEL_LINE_HEIGHT) / 2

  return (
    <text x={x - 6} y={top} textAnchor="end" dominantBaseline="central" className="fill-foreground text-xs">
      {lines.map((line, index) => (
        <tspan key={index} x={x - 6} dy={index === 0 ? 0 : LABEL_LINE_HEIGHT}>
          {line}
        </tspan>
      ))}
    </text>
  )
}

export { WrappedTick }
export type { WrappedTickProps }
