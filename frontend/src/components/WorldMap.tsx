// Animated flat world map — replaces the spinning globe in the hero.
//
// V2 of the design: continents are now hand-crafted polygons approximating
// real coastlines (NA, SA, Europe, Africa, Asia, Australia, plus a few
// island groups), then point-in-polygon-tested at a ~2.5° dot grid. The
// previous v1 used axis-aligned bounding boxes — which made continents
// render as visible rectangles on a flat projection. The polygons aren't
// geographically perfect but they read as the right shapes at a glance.

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

// Cycled flight pairs. Mixed long-haul + intra-region so arcs don't all
// look like the same big curve.
const ARC_PAIRS: [string, string][] = [
  ['US', 'JP'],
  ['EU', 'KR'],
  ['CHM', 'AP'],
  ['JP', 'EU'],
  ['CN', 'US'],
  ['AP', 'JP'],
  ['EU', 'CHM'],
]

// Continent polygons. Each is a closed (lng, lat) ring. Approximations —
// they snap landmasses to recognizable silhouettes without trying to be
// cartographically accurate.
type Polygon = [number, number][]
const CONTINENTS: Polygon[] = [
  // North America (Alaska through Mexico + Central America)
  [
    [-166, 68], [-156, 71], [-128, 70], [-105, 69], [-95, 62], [-80, 62],
    [-65, 53], [-55, 50], [-66, 44], [-70, 41], [-76, 36], [-80, 30],
    [-83, 25], [-90, 22], [-98, 18], [-109, 23], [-117, 32], [-125, 40],
    [-132, 50], [-140, 58], [-152, 60], [-166, 68],
  ],
  // South America
  [
    [-78, 12], [-72, 11], [-60, 8], [-50, 1], [-42, -5], [-37, -10],
    [-38, -22], [-48, -28], [-58, -38], [-66, -46], [-70, -54],
    [-74, -50], [-72, -38], [-72, -22], [-78, -10], [-80, -2],
    [-78, 6], [-78, 12],
  ],
  // Europe (incl. western Russia, Scandinavia)
  [
    [-10, 36], [-9, 43], [-1, 43], [3, 47], [3, 51], [9, 54],
    [11, 58], [18, 65], [25, 70], [33, 70], [40, 67], [42, 60],
    [40, 50], [30, 45], [28, 41], [22, 39], [12, 38], [3, 38],
    [-5, 36], [-10, 36],
  ],
  // Africa
  [
    [-17, 14], [-17, 28], [-10, 32], [0, 36], [10, 36], [22, 32],
    [33, 30], [38, 18], [44, 12], [51, 11], [50, 2], [42, -3],
    [40, -10], [40, -18], [35, -25], [30, -29], [22, -34], [18, -34],
    [12, -22], [10, -10], [5, -3], [-5, 4], [-15, 8], [-17, 14],
  ],
  // Asia (Turkey through Kamchatka + India + SE Asia mainland)
  [
    [42, 38], [50, 40], [60, 45], [65, 55], [60, 65], [70, 70],
    [90, 72], [110, 72], [130, 70], [142, 65], [148, 58], [142, 50],
    [135, 45], [130, 38], [122, 30], [122, 22], [110, 18], [104, 10],
    [100, 5], [97, 8], [97, 16], [92, 22], [88, 22], [82, 18],
    [78, 8], [73, 18], [68, 24], [60, 25], [55, 28], [50, 30],
    [44, 36], [42, 38],
  ],
  // Australia
  [
    [115, -22], [125, -14], [135, -12], [142, -10], [146, -18],
    [152, -25], [150, -34], [142, -38], [130, -34], [115, -34],
    [113, -28], [115, -22],
  ],
  // Japan (rough single-shape blob covering Honshu/Shikoku/Kyushu)
  [
    [130, 31], [134, 33], [139, 35], [141, 38], [142, 42], [144, 44],
    [141, 45], [137, 38], [134, 35], [130, 32], [130, 31],
  ],
  // UK + Ireland
  [
    [-10, 50], [-6, 52], [-3, 56], [-1, 58], [2, 56], [2, 52],
    [0, 50], [-4, 49], [-10, 50],
  ],
  // Madagascar
  [
    [43, -12], [49, -14], [50, -22], [46, -25], [43, -22], [43, -12],
  ],
  // Indonesia + Philippines (rough archipelago band)
  [
    [95, 6], [105, 6], [115, 6], [125, 7], [125, 18], [122, 18],
    [120, 13], [115, 0], [108, -3], [115, -8], [125, -8], [135, -3],
    [140, -2], [135, -7], [125, -10], [115, -10], [105, -7], [98, -3],
    [95, 6],
  ],
  // Iceland (small, but visually grounds NW Europe)
  [
    [-24, 63], [-20, 66], [-14, 66], [-13, 64], [-18, 63], [-24, 63],
  ],
  // New Zealand
  [
    [166, -47], [171, -41], [175, -37], [178, -38], [174, -42], [170, -46],
    [166, -47],
  ],
  // Greenland (subtle, just to anchor the top)
  [
    [-50, 60], [-30, 60], [-22, 70], [-25, 80], [-50, 82], [-60, 78],
    [-58, 70], [-50, 60],
  ],
]

// Ray-casting point-in-polygon.
function pointInPolygon(x: number, y: number, poly: Polygon): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

function inLandmass(lng: number, lat: number): boolean {
  for (const poly of CONTINENTS) {
    if (pointInPolygon(lng, lat, poly)) return true
  }
  return false
}

// Equirectangular. Latitude clipped so the map fills the viewBox without
// huge polar bands.
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

export function WorldMap({
  onSelectCountry,
  width = 540,
  height = 540,
}: WorldMapProps) {
  const [arcIdx, setArcIdx] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setArcIdx((i) => (i + 1) % ARC_PAIRS.length)
    }, ARC_DURATION_MS)
    return () => clearInterval(id)
  }, [])

  // Dot grid clipped to land polygons. ~2.4° step gives ~1.5k visible dots
  // on land — dense enough to look textured, light enough to render fast.
  const landDots = useMemo(() => {
    const pts: { x: number; y: number }[] = []
    for (let lng = -178; lng <= 180; lng += 2.4) {
      for (let lat = -56; lat <= 76; lat += 2.4) {
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
  const mx = (aP.x + bP.x) / 2
  const lift = Math.max(48, Math.abs(bP.x - aP.x) * 0.24)
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
      {/* Land dots */}
      <g>
        {landDots.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={1.6} fill="var(--ink)" opacity={0.22} />
        ))}
      </g>

      {/* Active flight arc — re-keyed each cycle to replay the draw. */}
      <g key={arcIdx}>
        <path
          d={arcD}
          fill="none"
          stroke="var(--pop)"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeDasharray="900"
          strokeDashoffset="900"
          style={{
            animation: `worldmap-arc-draw ${ARC_DURATION_MS}ms cubic-bezier(.4,.05,.2,1) forwards`,
          }}
        />
        {/* Travelling dot riding the arc */}
        <circle r="5" fill="var(--pop)">
          <animateMotion dur={`${ARC_DURATION_MS}ms`} repeatCount="1" path={arcD} keyPoints="0;1" keyTimes="0;1" />
          <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.85;1" dur={`${ARC_DURATION_MS}ms`} repeatCount="1" />
        </circle>
      </g>

      {/* City pins — bigger than v1 so they actually register. */}
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
              {/* Pulse ring */}
              <circle
                r={9}
                fill={isActive ? 'var(--pop)' : 'var(--accent-soft)'}
                opacity={isActive ? 0.45 : 0.32}
              >
                <animate attributeName="r" values="9;20;9" dur="2.6s" repeatCount="indefinite" />
                <animate
                  attributeName="opacity"
                  values={isActive ? '0.65;0;0.65' : '0.45;0;0.45'}
                  dur="2.6s"
                  repeatCount="indefinite"
                />
              </circle>
              {/* Solid dot */}
              <circle r={isActive ? 6.5 : 5} fill={isActive ? 'var(--pop)' : 'var(--accent)'} />
              <circle r={2} fill="var(--bg)" />
            </g>
          )
        })}
      </g>
    </svg>
  )
}
