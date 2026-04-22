// Animated SVG globe — orthographic projection.
// Ported from design/globe.jsx.
//
// The globe auto-rotates ~6°/sec, shows a graticule, a masked dot-grid
// landmass, flight arcs, a satellite, a starfield, and city markers.
// City markers are clickable — clicking navigates to /destinations/:code
// via the onSelectCountry callback.

import { useEffect, useMemo, useRef, useState } from 'react'

interface GlobeProps {
  onSelectCountry?: (code: string) => void
  highlightCode?: string | null
  size?: number
}

interface CityMarker {
  code: string
  flag: string
  lng: number
  lat: number
}

// Cities to highlight on the globe. Limited to countries where we have plans
// plus a couple of visually-balanced placeholders for the far hemisphere.
const CITIES: CityMarker[] = [
  { code: 'US', flag: '🇺🇸', lng: -98.0,  lat: 39.5  },
  { code: 'JP', flag: '🇯🇵', lng: 139.69, lat: 35.68 },
  { code: 'KR', flag: '🇰🇷', lng: 126.98, lat: 37.57 },
  { code: 'CN', flag: '🇨🇳', lng: 116.4,  lat: 39.9  },
  { code: 'EU', flag: '🇪🇺', lng: 10.0,   lat: 50.0  },
  { code: 'AP', flag: '🌏', lng: 120.0,   lat: 10.0  },
]

// Flight arcs between city pairs — purely decorative.
const ARCS: [string, string][] = [
  ['US', 'JP'],
  ['EU', 'US'],
  ['AP', 'EU'],
  ['CN', 'KR'],
]

const TILT = -14 // axial tilt in degrees

// Land-mass bounding boxes (lng-min, lng-max, lat-min, lat-max).
// Used as a rough mask for the dot-grid to suggest continents.
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
]

// Deterministic PRNG so the starfield/noise is stable across renders.
function seeded(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

function project(
  lng: number,
  lat: number,
  rotLng: number,
  radius: number,
  cx: number,
  cy: number,
): { x: number; y: number; z: number } {
  // Rotate around Y axis (longitude).
  const lon = ((lng + rotLng + 540) % 360) - 180
  const lonRad = (lon * Math.PI) / 180
  const latRad = (lat * Math.PI) / 180

  // Convert to 3D coords on unit sphere.
  let x = Math.cos(latRad) * Math.sin(lonRad)
  let y = Math.sin(latRad)
  let z = Math.cos(latRad) * Math.cos(lonRad)

  // Axial tilt on X axis.
  const tiltRad = (TILT * Math.PI) / 180
  const yt = y * Math.cos(tiltRad) - z * Math.sin(tiltRad)
  const zt = y * Math.sin(tiltRad) + z * Math.cos(tiltRad)
  y = yt
  z = zt

  // Orthographic projection.
  return {
    x: cx + x * radius,
    y: cy - y * radius,
    z, // z>0 = front-hemisphere, visible
  }
}

function inLandmass(lng: number, lat: number): boolean {
  for (const [x1, x2, y1, y2] of LANDMASS) {
    if (lng >= x1 && lng <= x2 && lat >= y1 && lat <= y2) return true
  }
  return false
}

export function Globe({ onSelectCountry, size = 560 }: GlobeProps) {
  const [rotLng, setRotLng] = useState(0)
  const [t, setT] = useState(0)
  const frameRef = useRef<number | null>(null)
  const lastRef = useRef<number>(performance.now())

  // Continuous rotation ~6°/sec plus a global time for arc/satellite animation.
  useEffect(() => {
    function tick(now: number) {
      const dt = (now - lastRef.current) / 1000
      lastRef.current = now
      setRotLng((r) => (r + dt * 6) % 360)
      setT((prev) => prev + dt)
      frameRef.current = requestAnimationFrame(tick)
    }
    frameRef.current = requestAnimationFrame(tick)
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
  }, [])

  const r = size * 0.357 // 200 for size=560
  const cx = size / 2
  const cy = size / 2

  // Deterministic grid dots across land bounding boxes.
  const landDots = useMemo(() => {
    const rng = seeded(42)
    const pts: { lng: number; lat: number }[] = []
    for (let lng = -180; lng <= 180; lng += 3.5) {
      for (let lat = -85; lat <= 85; lat += 3.5) {
        if (!inLandmass(lng, lat)) continue
        if (rng() < 0.6) pts.push({ lng, lat })
      }
    }
    return pts
  }, [])

  const stars = useMemo(() => {
    const rng = seeded(7)
    return Array.from({ length: 90 }, () => ({
      x: rng() * size,
      y: rng() * size,
      r: 0.4 + rng() * 1.2,
      seed: rng() * Math.PI * 2,
    }))
  }, [size])

  const cityProjected = CITIES.map((c) => ({ city: c, p: project(c.lng, c.lat, rotLng, r, cx, cy) }))

  // Arc great-circle polyline, sampled, raised with sin(πf) lift.
  function arcPath(a: CityMarker, b: CityMarker): string {
    const STEPS = 36
    let d = ''
    for (let i = 0; i <= STEPS; i++) {
      const f = i / STEPS
      // Spherical linear interpolation of lng/lat is rough but fine for aesthetic arcs.
      const lng = a.lng + (b.lng - a.lng) * f
      const lat = a.lat + (b.lat - a.lat) * f
      const p = project(lng, lat, rotLng, r + Math.sin(Math.PI * f) * 26, cx, cy)
      if (p.z < -0.25) continue
      d += i === 0 ? `M${p.x.toFixed(2)} ${p.y.toFixed(2)}` : ` L${p.x.toFixed(2)} ${p.y.toFixed(2)}`
    }
    return d
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
      <defs>
        <radialGradient id="globe-atmo" cx="50%" cy="50%" r="65%">
          <stop offset="60%" stopColor="var(--accent-soft)" stopOpacity="0" />
          <stop offset="92%" stopColor="var(--accent-soft)" stopOpacity="0.7" />
          <stop offset="100%" stopColor="var(--accent-soft)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="globe-shade" cx="75%" cy="75%" r="60%">
          <stop offset="0%" stopColor="var(--ink)" stopOpacity="0" />
          <stop offset="100%" stopColor="var(--ink)" stopOpacity="0.2" />
        </radialGradient>
        <radialGradient id="globe-gloss" cx="28%" cy="28%" r="35%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Starfield (mostly invisible on light palettes, comes alive on midnight) */}
      {stars.map((s, i) => (
        <circle
          key={i}
          cx={s.x}
          cy={s.y}
          r={s.r}
          fill="var(--ink-3)"
          opacity={0.15 + 0.25 * (0.5 + 0.5 * Math.sin(t * 1.4 + s.seed))}
        />
      ))}

      {/* Outer atmosphere glow */}
      <circle cx={cx} cy={cy} r={r + 40} fill="url(#globe-atmo)" />

      {/* Globe base */}
      <circle cx={cx} cy={cy} r={r} fill="var(--bg-elev)" stroke="var(--line-strong)" strokeWidth={0.7} />

      {/* Graticule */}
      <g stroke="var(--line-strong)" strokeWidth={0.4} fill="none" opacity={0.5}>
        {[-60, -30, 0, 30, 60].map((lat) => {
          const ry = Math.abs(Math.cos((lat * Math.PI) / 180)) * r
          const y = cy - Math.sin((lat * Math.PI) / 180) * r
          return <ellipse key={lat} cx={cx} cy={y} rx={r} ry={ry * 0.12} />
        })}
        {[0, 30, 60, 90, 120, 150].map((lng) => {
          const startLng = lng
          const d = Array.from({ length: 61 }, (_, i) => {
            const lat = -90 + i * 3
            const p = project(startLng, lat, rotLng, r, cx, cy)
            return `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`
          }).join(' ')
          return <path key={lng} d={d} />
        })}
      </g>

      {/* Land dots */}
      <g>
        {landDots.map((d, i) => {
          const p = project(d.lng, d.lat, rotLng, r, cx, cy)
          if (p.z < 0) return null
          const op = 0.3 + p.z * 0.65
          return <circle key={i} cx={p.x} cy={p.y} r={1.1} fill="var(--ink)" opacity={op} />
        })}
      </g>

      {/* Terminator shade + gloss */}
      <circle cx={cx} cy={cy} r={r} fill="url(#globe-shade)" />
      <circle cx={cx} cy={cy} r={r} fill="url(#globe-gloss)" />

      {/* Equator accent */}
      <ellipse
        cx={cx}
        cy={cy}
        rx={r}
        ry={r * 0.05}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={0.8}
        strokeDasharray="2 4"
        opacity={0.35}
      />

      {/* Flight arcs */}
      <g>
        {ARCS.map(([aCode, bCode], i) => {
          const a = CITIES.find((c) => c.code === aCode)
          const b = CITIES.find((c) => c.code === bCode)
          if (!a || !b) return null
          return (
            <path
              key={i}
              d={arcPath(a, b)}
              fill="none"
              stroke="var(--pop)"
              strokeWidth={1.2}
              strokeDasharray="2 6"
              strokeDashoffset={t * 40}
              opacity={0.75}
            />
          )
        })}
      </g>

      {/* Satellite */}
      <g>
        {(() => {
          const angle = t * ((2 * Math.PI) / 10)
          const orbitR = r + 46
          const x = cx + Math.cos(angle) * orbitR
          const y = cy - Math.sin(angle) * orbitR * 0.35
          return (
            <g transform={`translate(${x} ${y})`}>
              <circle r={3.4} fill="var(--ink)" />
              <circle r={8} fill="none" stroke="var(--ink)" strokeWidth={0.6} opacity={0.4} />
            </g>
          )
        })()}
      </g>

      {/* City markers — interactive */}
      <g>
        {cityProjected.map(({ city, p }) => {
          if (p.z < 0) return null
          const op = 0.5 + p.z * 0.5
          return (
            <g
              key={city.code}
              transform={`translate(${p.x} ${p.y})`}
              style={{ cursor: 'pointer' }}
              onClick={() => onSelectCountry?.(city.code)}
            >
              <circle r={10} fill="var(--accent-soft)" opacity={0.35 * op}>
                <animate attributeName="r" values="10;16;10" dur="2.4s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.5;0;0.5" dur="2.4s" repeatCount="indefinite" />
              </circle>
              <circle r={4.5} fill="var(--accent)" opacity={op} />
              <circle r={1.5} fill="var(--bg)" />
            </g>
          )
        })}
      </g>
    </svg>
  )
}
