// Animated flat world map — replaces the spinning globe in the hero.
//
// Renders dotted continents (equirectangular projection, same LANDMASS
// boxes the old Globe used) plus city pins for our 7 destinations. Every
// few seconds a new flight arc draws between two random cities — the
// "connection just landed" beat — and the endpoint pins flash to the pop
// accent. Pure SVG + CSS animations; no extra deps.
//
// The signature is a drop-in replacement for the old <Globe> usage in
// Landing.tsx so the surrounding floating cards (Tokyo · 5G live, Seoul ·
// Connected) keep working.

import { useEffect, useMemo, useState } from 'react'

interface WorldMapProps {
  onSelectCountry?: (code: string) => void
  width?: number
  height?: number
}

interface City {
  code: string
  name: string
  lng: number
  lat: number
}

const CITIES: City[] = [
  { code: 'US',  name: 'New York',  lng: -74.0,  lat: 40.7  },
  { code: 'JP',  name: 'Tokyo',     lng: 139.69, lat: 35.68 },
  { code: 'KR',  name: 'Seoul',     lng: 126.98, lat: 37.57 },
  { code: 'CN',  name: 'Beijing',   lng: 116.4,  lat: 39.9  },
  { code: 'EU',  name: 'Paris',     lng: 2.35,   lat: 48.85 },
  { code: 'AP',  name: 'Singapore', lng: 103.8,  lat: 1.35  },
  { code: 'CHM', name: 'Hong Kong', lng: 114.17, lat: 22.32 },
]

// Cycled in order — each pair is a "flight" the map draws and pulses.
// Mixed long-haul + intra-region pairs so the arcs don't all look alike.
const ARC_PAIRS: [string, string][] = [
  ['US', 'JP'],
  ['EU', 'KR'],
  ['CHM', 'AP'],
  ['JP', 'EU'],
  ['CN', 'US'],
  ['AP', 'JP'],
  ['EU', 'CHM'],
]

// Continent bounding boxes — rough but recognizable as a stippled map.
const LANDMASS: [number, number, number, number][] = [
  [-170, -52, 15, 72],   // North America
  [-82, -34, -56, 12],   // South America
  [-10, 40, 35, 70],     // Europe
  [-18, 52, -35, 35],    // Africa
  [40, 150, 10, 70],     // Asia
  [110, 155, -45, -10],  // Australia
  [-130, -105, 50, 70],  // Alaska + NW Canada
  [120, 140, 30, 46],    // Japan
  [-80, -60, 10, 25],    // Caribbean
  [165, 180, -47, -34],  // New Zealand
]

function inLandmass(lng: number, lat: number): boolean {
  for (const [x1, x2, y1, y2] of LANDMASS) {
    if (lng >= x1 && lng <= x2 && lat >= y1 && lat <= y2) return true
  }
  return false
}

// Equirectangular projection. Latitude clipped to [-58, 78] so the map
// fills the viewBox without empty polar bands.
const VB_W = 800
const VB_H = 400
const LAT_TOP = 78
const LAT_BOT = -58

function project(lng: number, lat: number) {
  const x = ((lng + 180) / 360) * VB_W
  const y = ((LAT_TOP - lat) / (LAT_TOP - LAT_BOT)) * VB_H
  return { x, y }
}

const ARC_DURATION_MS = 2800

export function WorldMap({ onSelectCountry, width = 540, height = 540 }: WorldMapProps) {
  const [arcIdx, setArcIdx] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setArcIdx((i) => (i + 1) % ARC_PAIRS.length)
    }, ARC_DURATION_MS)
    return () => clearInterval(id)
  }, [])

  const landDots = useMemo(() => {
    const pts: { x: number; y: number }[] = []
    for (let lng = -180; lng <= 180; lng += 3.5) {
      for (let lat = -60; lat <= 78; lat += 3.5) {
        if (inLandmass(lng, lat)) pts.push(project(lng, lat))
      }
    }
    return pts
  }, [])

  const [aCode, bCode] = ARC_PAIRS[arcIdx]
  const a = CITIES.find((c) => c.code === aCode)!
  const b = CITIES.find((c) => c.code === bCode)!
  const aP = project(a.lng, a.lat)
  const bP = project(b.lng, b.lat)

  // Quadratic bezier control point — midpoint lifted up to make the arc.
  // Lift scales with horizontal distance so short hops aren't huge bumps.
  const mx = (aP.x + bP.x) / 2
  const lift = Math.max(40, Math.abs(bP.x - aP.x) * 0.22)
  const my = (aP.y + bP.y) / 2 - lift
  const arcD = `M${aP.x.toFixed(1)} ${aP.y.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${bP.x.toFixed(1)} ${bP.y.toFixed(1)}`

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ overflow: 'visible' }}
    >
      {/* Land dots — stippled continent silhouettes */}
      <g>
        {landDots.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={1.2} fill="var(--ink)" opacity={0.18} />
        ))}
      </g>

      {/* Active flight arc — re-keyed on each cycle so the CSS draw-in
          animation replays from scratch. */}
      <g key={arcIdx}>
        <path
          d={arcD}
          fill="none"
          stroke="var(--pop)"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeDasharray="900"
          strokeDashoffset="900"
          style={{ animation: `worldmap-arc-draw ${ARC_DURATION_MS}ms cubic-bezier(.4,.05,.2,1) forwards` }}
        />
        {/* Travelling pulse — a small dot rides the arc */}
        <circle r="3.5" fill="var(--pop)">
          <animateMotion dur={`${ARC_DURATION_MS}ms`} repeatCount="1" path={arcD} keyPoints="0;1" keyTimes="0;1" />
          <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.85;1" dur={`${ARC_DURATION_MS}ms`} repeatCount="1" />
        </circle>
      </g>

      {/* City pins */}
      <g>
        {CITIES.map((c) => {
          const p = project(c.lng, c.lat)
          const isActive = c.code === aCode || c.code === bCode
          return (
            <g
              key={c.code}
              transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`}
              style={{ cursor: 'pointer' }}
              onClick={() => onSelectCountry?.(c.code)}
              aria-label={c.name}
            >
              {/* Outer pulse ring — always animating, breathes */}
              <circle r={6} fill={isActive ? 'var(--pop)' : 'var(--accent-soft)'} opacity={isActive ? 0.4 : 0.3}>
                <animate
                  attributeName="r"
                  values="6;14;6"
                  dur="2.6s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values={isActive ? '0.6;0;0.6' : '0.4;0;0.4'}
                  dur="2.6s"
                  repeatCount="indefinite"
                />
              </circle>
              {/* Solid pin */}
              <circle r={isActive ? 4.5 : 3.5} fill={isActive ? 'var(--pop)' : 'var(--accent)'} />
              <circle r={1.5} fill="var(--bg)" />
            </g>
          )
        })}
      </g>
    </svg>
  )
}
