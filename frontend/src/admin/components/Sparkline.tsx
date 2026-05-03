interface SparklineProps {
  values: number[]
  width?: number
  height?: number
  fill?: string
  stroke?: string
}

// Minimal filled-area sparkline, no dep. Pads missing values; flat-line on
// empty input.
export function Sparkline({
  values,
  width = 220,
  height = 48,
  fill = 'currentColor',
  stroke = 'currentColor',
}: SparklineProps) {
  if (values.length === 0) {
    return (
      <svg width={width} height={height} aria-hidden="true">
        <line
          x1="0"
          y1={height - 1}
          x2={width}
          y2={height - 1}
          stroke={stroke}
          strokeOpacity="0.2"
          strokeWidth="1"
        />
      </svg>
    )
  }
  const min = Math.min(...values, 0)
  const max = Math.max(...values, 1)
  const range = Math.max(1, max - min)
  const stepX = width / Math.max(1, values.length - 1)

  const pts = values.map((v, i) => {
    const x = i * stepX
    const y = height - ((v - min) / range) * (height - 4) - 2
    return [x, y] as const
  })

  const linePath = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L${width} ${height} L0 ${height} Z`

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={areaPath} fill={fill} fillOpacity="0.12" />
      <path d={linePath} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
