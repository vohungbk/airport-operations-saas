import { seriesColor, seriesMarker, type SeriesMarker } from "@/lib/charts/chart-tokens"

/** Points of a star with five tips, around (0, 0). */
const STAR = Array.from({ length: 10 }, (_, i) => {
  const radius = i % 2 === 0 ? 7 : 3
  const angle = (Math.PI / 5) * i - Math.PI / 2
  return `${(radius * Math.cos(angle)).toFixed(2)},${(radius * Math.sin(angle)).toFixed(2)}`
}).join(" ")

function shape(marker: SeriesMarker, color: string) {
  switch (marker) {
    case "circle":
      return <circle r={5} fill={color} />
    case "square":
      return <rect x={-4.5} y={-4.5} width={9} height={9} fill={color} />
    case "triangle":
      return <polygon points="0,-6 6,5 -6,5" fill={color} />
    case "diamond":
      return <polygon points="0,-6.5 6.5,0 0,6.5 -6.5,0" fill={color} />
    case "cross":
      return <path d="M-5,0 H5 M0,-5 V5" stroke={color} strokeWidth={3} fill="none" />
    case "star":
      return <polygon points={STAR} fill={color} />
  }
}

interface ChartMarkerProps {
  marker: SeriesMarker
  x?: number
  y?: number
  /** A chart token, given by the caller; the marker never picks a color. */
  color: string
}

/** The shape of a point, drawn around (x, y). Series that sit next to each other differ by shape as well as color (spec R7). */
function ChartMarker({ marker, x = 0, y = 0, color }: ChartMarkerProps) {
  return (
    <g data-marker={marker} transform={`translate(${x} ${y})`}>
      {shape(marker, color)}
    </g>
  )
}

/** The key of a legend for a line: the marker and color of series `index`. */
function MarkerSwatch({ index }: { index: number }) {
  return (
    <svg aria-hidden="true" width={14} height={14} viewBox="-7 -7 14 14" className="shrink-0">
      <ChartMarker marker={seriesMarker(index)} color={seriesColor(index)} />
    </svg>
  )
}

export { ChartMarker, MarkerSwatch }
export type { ChartMarkerProps }
