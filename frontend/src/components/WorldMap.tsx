// Animated flat world map — replaces the spinning globe in the hero.
//
// V3 of the design. Continent silhouettes now come from Natural Earth 110m
// land data (via the world-atlas package), so coastlines are real instead
// of hand-drawn polygons. Same dot-mask aesthetic — dots are clipped to
// the multipolygon at a 2.4° grid.
//
// Other v3 improvements:
//   * Active flight arc: thicker stroke, navy ink color (was orange — got
//     washed out against the beige bg), soft drop-shadow filter, and an
//     animated label "City A → City B" that fades in with each cycle.
//   * Active city pins: white outer ring + larger solid circle so the
//     "live pair" reads at a glance.

import { useEffect, useMemo, useState } from 'react'
import { feature } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson'
// Vite handles JSON imports natively. ~55KB raw, ~12KB gzipped.
import landTopo from 'world-atlas/land-110m.json'

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

// Mixed long-haul + intra-region pairs so the cycling arcs don't all look
// the same. Each cycle takes ARC_DURATION_MS.
const ARC_PAIRS: [string, string][] = [
  ['US', 'JP'],
  ['EU', 'KR'],
  ['CHM', 'AP'],
  ['JP', 'EU'],
  ['CN', 'US'],
  ['AP', 'JP'],
  ['EU', 'CHM'],
]

// Resolve land-110m TopoJSON → FeatureCollection of land polygons.
// land-110m's `objects.land` is a TopoJSON GeometryCollection (one feature
// per land mass), so feature() returns a FeatureCollection — not a single
// Feature.
const landCollection = feature(
  landTopo as unknown as Topology,
  (landTopo as unknown as { objects: { land: GeometryCollection } }).objects.land,
) as FeatureCollection<MultiPolygon | Polygon>

function pointInRing(x: number, y: number, ring: number[][]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0]
    const yi = ring[i][1]
    const xj = ring[j][0]
    const yj = ring[j][1]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

function pointOnLand(lng: number, lat: number): boolean {
  // We test the (lng, lat) against every outer ring across every land
  // feature. polygon[0] is the outer ring; subsequent rings are holes
  // (lakes, inland seas) — ignored for the dot mask. A few dots inside a
  // lake actually adds visual texture.
  for (const f of landCollection.features) {
    const g = f.geometry
    if (g.type === 'MultiPolygon') {
      for (const polygon of g.coordinates) {
        if (pointInRing(lng, lat, polygon[0])) return true
      }
    } else if (g.type === 'Polygon') {
      if (pointInRing(lng, lat, g.coordinates[0])) return true
    }
  }
  return false
}

// Equirectangular projection. Latitudes clipped so the map fills the
// viewBox without giant polar bands.
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

  // 2.4° dot grid clipped to land. ~5k visible dots — dense enough to
  // texture but cheap to render.
  const landDots = useMemo(() => {
    const pts: { x: number; y: number }[] = []
    for (let lng = -178; lng <= 180; lng += 2.4) {
      for (let lat = -56; lat <= 76; lat += 2.4) {
        if (pointOnLand(lng, lat)) pts.push(project(lng, lat))
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

  // Label placement: just above the arc midpoint (a hair above the bezier
  // control point's y, since the visual peak of the curve is below the
  // control point).
  const labelX = mx
  const labelY = my + lift * 0.4

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ overflow: 'visible' }}
    >
      <defs>
        {/* Soft drop-shadow under the arc so it floats above the dot mask. */}
        <filter id="worldmap-arc-shadow" x="-5%" y="-50%" width="110%" height="200%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
          <feOffset dx="0" dy="1" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.35" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Land dots — Natural Earth 110m coastlines */}
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
          stroke="var(--ink)"
          strokeWidth={3.5}
          strokeLinecap="round"
          strokeDasharray="900"
          strokeDashoffset="900"
          filter="url(#worldmap-arc-shadow)"
          style={{
            animation: `worldmap-arc-draw ${ARC_DURATION_MS}ms cubic-bezier(.4,.05,.2,1) forwards`,
          }}
        />
        {/* Travelling dot riding the arc */}
        <circle r="6" fill="var(--pop)">
          <animateMotion dur={`${ARC_DURATION_MS}ms`} repeatCount="1" path={arcD} keyPoints="0;1" keyTimes="0;1" />
          <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.85;1" dur={`${ARC_DURATION_MS}ms`} repeatCount="1" />
        </circle>
        {/* "City → City" label that fades in/out with the arc */}
        <text
          x={labelX}
          y={labelY}
          textAnchor="middle"
          fontFamily="var(--mono)"
          fontSize="13"
          fontWeight="500"
          letterSpacing="0.04em"
          fill="var(--ink)"
          opacity="0"
          style={{
            animation: `worldmap-label-fade ${ARC_DURATION_MS}ms ease-out forwards`,
          }}
        >
          {a.name.toUpperCase()} → {b.name.toUpperCase()}
        </text>
      </g>

      {/* City pins. Active pair gets a white outer ring + bigger solid
          circle so the "live" pair pops over the inactive ones. */}
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
                opacity={isActive ? 0.5 : 0.32}
              >
                <animate attributeName="r" values="9;22;9" dur="2.6s" repeatCount="indefinite" />
                <animate
                  attributeName="opacity"
                  values={isActive ? '0.7;0;0.7' : '0.45;0;0.45'}
                  dur="2.6s"
                  repeatCount="indefinite"
                />
              </circle>
              {/* White halo for active pins only — sharp visual delta. */}
              {isActive && (
                <circle r={11} fill="none" stroke="var(--bg)" strokeWidth={3} />
              )}
              {/* Solid dot */}
              <circle
                r={isActive ? 8 : 5}
                fill={isActive ? 'var(--pop)' : 'var(--accent)'}
              />
              <circle r={isActive ? 2.5 : 2} fill="var(--bg)" />
            </g>
          )
        })}
      </g>
    </svg>
  )
}
