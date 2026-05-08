// Stylized phone illustrations for the How-it-works step cards. One
// shared phone frame (rounded rect + notch + dynamic-island-ish bar at
// the bottom for the home indicator) with a step-specific focal element
// drawn inside the screen. Line art, 1.6 stroke, accent fills only for
// the active element each step is teaching. Single colour palette so
// the illustrations adapt cleanly to dark mode if/when added.

type Method = 'onetap' | 'qr' | 'manual'
type StepIdx = 0 | 1 | 2

interface Props {
  method: Method
  step: StepIdx
}

const VB_W = 200
const VB_H = 200

// Inner screen rect dimensions (where step-specific content draws).
const SX = 60 // screen left
const SY = 30 // screen top
const SW = 80 // screen width
const SH = 140 // screen height

// Stylized but dense QR — three finder squares (top-left / top-right /
// bottom-left) and a randomized but deterministic data grid filling the
// middle. Looks legibly "QR" without trying to actually encode anything.
function DenseQr({ cx, cy, size }: { cx: number; cy: number; size: number }) {
  const cells = 11 // grid resolution
  const cell = size / cells
  const x0 = cx - size / 2
  const y0 = cy - size / 2
  // Deterministic pseudo-random fill — same seed → same pattern.
  const fill = (i: number, j: number) => {
    return ((i * 31 + j * 17 + i * j * 7) % 100) < 48
  }
  // Inside the 3 finder areas (3x3 in each corner) we don't draw data
  // pixels — those are reserved for the finder squares.
  const isFinderArea = (i: number, j: number) =>
    (i < 3 && j < 3) || (i < 3 && j > cells - 4) || (i > cells - 4 && j < 3)
  const data: React.ReactElement[] = []
  for (let i = 0; i < cells; i++) {
    for (let j = 0; j < cells; j++) {
      if (isFinderArea(i, j)) continue
      if (fill(i, j)) {
        data.push(
          <rect
            key={`${i}-${j}`}
            x={x0 + j * cell}
            y={y0 + i * cell}
            width={cell}
            height={cell}
            fill="var(--ink)"
          />,
        )
      }
    }
  }
  // Finder square = outer 3x3 ink square with an inner 1x1 ink dot in
  // the middle of an inset 1x1 white ring.
  const finder = (i: number, j: number) => {
    const fx = x0 + j * cell
    const fy = y0 + i * cell
    return (
      <g key={`f-${i}-${j}`}>
        <rect x={fx} y={fy} width={cell * 3} height={cell * 3} fill="var(--ink)" />
        <rect x={fx + cell * 0.5} y={fy + cell * 0.5} width={cell * 2} height={cell * 2} fill="var(--bg-elev)" />
        <rect x={fx + cell} y={fy + cell} width={cell} height={cell} fill="var(--ink)" />
      </g>
    )
  }
  return (
    <g>
      {data}
      {finder(0, 0)}
      {finder(0, cells - 3)}
      {finder(cells - 3, 0)}
    </g>
  )
}

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      role="img"
      aria-hidden="true"
      style={{ display: 'block', width: '100%', height: '100%' }}
    >
      {/* Outer device body */}
      <rect
        x="54"
        y="22"
        width="92"
        height="156"
        rx="14"
        fill="var(--bg)"
        stroke="var(--ink)"
        strokeWidth="1.6"
      />
      {/* Notch */}
      <rect x="86" y="26" width="28" height="4" rx="2" fill="var(--ink)" opacity="0.3" />
      {/* Screen border (subtle inner rect) */}
      <rect
        x={SX}
        y={SY}
        width={SW}
        height={SH}
        rx="9"
        fill="none"
        stroke="var(--line)"
        strokeWidth="1"
      />
      {/* Step-specific content drawn into the screen */}
      {children}
      {/* Home indicator bar */}
      <rect x="86" y="170" width="28" height="2" rx="1" fill="var(--ink)" opacity="0.35" />
    </svg>
  )
}

// === Screen variants ============================================
// Coordinates assume the screen rect at (SX=60, SY=30, SW=80, SH=140).
// Drawing helpers operate within this rect.

function Envelope() {
  // Centered envelope with an accent pill below — represents "email
  // arrives with an install button". No simulated text bars.
  return (
    <g>
      {/* Envelope body */}
      <rect x={72} y={64} width={56} height={36} rx="3" fill="none" stroke="var(--ink)" strokeWidth="1.6" />
      <path d="M72 70 L100 88 L128 70" fill="none" stroke="var(--ink)" strokeWidth="1.6" strokeLinejoin="round" />
      {/* Install pill (no text — shape conveys "button") */}
      <rect x={72} y={122} width={56} height={20} rx="10" fill="var(--accent)" />
    </g>
  )
}

function TapButton() {
  // Centered chunky pill with a tap ripple radiating out — the focal
  // moment of the one-tap flow.
  return (
    <g>
      {/* Tap ripples (drawn first, behind the button) */}
      <circle cx={100} cy={100} r={42} fill="none" stroke="var(--accent)" strokeWidth="1" opacity="0.18" />
      <circle cx={100} cy={100} r={32} fill="none" stroke="var(--accent)" strokeWidth="1" opacity="0.4" />
      {/* The button */}
      <rect x={68} y={88} width={64} height={26} rx="13" fill="var(--accent)" />
    </g>
  )
}

function ConnectedCheck() {
  // Big check + signal bars — the success state. Signal bars provide
  // the "you're online" semantic without needing a "Connected" label.
  return (
    <g>
      {/* Signal bars top-right of screen */}
      <rect x={118} y={42} width={3} height={4} fill="var(--ink-2)" />
      <rect x={123} y={40} width={3} height={6} fill="var(--ink-2)" />
      <rect x={128} y={38} width={3} height={8} fill="var(--ink-2)" />
      {/* Big circle with check — centered focal element */}
      <circle cx={100} cy={100} r={22} fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="1.6" />
      <path
        d="M89 100 L97 108 L111 92"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  )
}

function LaptopWithQr() {
  // Big laptop (external screen) showing a dense QR code, replacing
  // the phone for this step entirely. The step is about putting the
  // QR onto a second device, so the laptop is the focal element and
  // the phone is implicit. Drawn full-width at viewBox scale.
  return (
    <g>
      {/* Hide the inherited phone frame — we draw a laptop instead */}
      <rect x={0} y={0} width={VB_W} height={VB_H} fill="var(--bg-elev)" />
      {/* Laptop body */}
      <rect x={28} y={48} width={144} height={104} rx="6" fill="var(--bg)" stroke="var(--ink)" strokeWidth="1.6" />
      {/* Inner screen rect */}
      <rect x={36} y={56} width={128} height={88} rx="2" fill="var(--bg-elev)" stroke="var(--line)" strokeWidth="1" />
      {/* QR code centered on the laptop screen */}
      <DenseQr cx={100} cy={100} size={64} />
      {/* Laptop base */}
      <path
        d="M16 152 L184 152 L172 162 L28 162 Z"
        fill="var(--bg)"
        stroke="var(--ink)"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* Hinge bar */}
      <line x1={92} y1={156} x2={108} y2={156} stroke="var(--ink-2)" strokeWidth="1.2" />
    </g>
  )
}

function SettingsList() {
  // Phone showing a Settings list with "Add eSIM" highlighted.
  return (
    <g>
      {/* Title bar */}
      <line x1={68} y1={42} x2={108} y2={42} stroke="var(--ink)" strokeWidth="1.6" />
      {/* List rows */}
      {[58, 76, 94].map((y, i) => (
        <g key={y}>
          <rect x={68} y={y} width={64} height={14} rx="2" fill={i === 1 ? 'var(--accent-soft)' : 'none'} stroke="var(--line)" strokeWidth="1" />
          <line x1={72} y1={y + 7} x2={i === 1 ? 110 : 96} y2={y + 7} stroke={i === 1 ? 'var(--accent)' : 'var(--ink-3)'} strokeWidth="1.2" />
          {/* Chevron */}
          <path
            d={`M124 ${y + 4} L128 ${y + 7} L124 ${y + 10}`}
            fill="none"
            stroke="var(--ink-3)"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      ))}
      {/* "Add eSIM" label hint */}
      <line x1={72} y1={113} x2={108} y2={113} stroke="var(--ink-3)" strokeWidth="1" />
      <line x1={72} y1={121} x2={96} y2={121} stroke="var(--ink-3)" strokeWidth="1" />
    </g>
  )
}

function QrPattern() {
  // Dense QR centered on the screen, framed by accent viewfinder
  // corner brackets (the camera UI overlay).
  return (
    <g>
      {/* Viewfinder corner brackets */}
      <path d="M66 56 L66 48 L74 48" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M126 48 L134 48 L134 56" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M66 144 L66 152 L74 152" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M126 152 L134 152 L134 144" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" />
      {/* The QR itself */}
      <DenseQr cx={100} cy={100} size={62} />
    </g>
  )
}

function EmailWithCodes() {
  // Envelope at top + two "code-looking" labeled rows below — the
  // activation email containing the SM-DP+ address and activation code.
  return (
    <g>
      {/* Envelope */}
      <rect x={78} y={50} width={44} height={28} rx="2" fill="none" stroke="var(--ink)" strokeWidth="1.4" />
      <path d="M78 54 L100 68 L122 54" fill="none" stroke="var(--ink)" strokeWidth="1.4" strokeLinejoin="round" />
      {/* Code row 1 — small label + monospace dashes inside a soft chip */}
      <rect x={70} y={92} width={60} height={18} rx="2" fill="var(--bg-sunk)" stroke="var(--line)" strokeWidth="1" />
      <line x1={74} y1={101} x2={84} y2={101} stroke="var(--ink-3)" strokeWidth="1.2" />
      <line x1={88} y1={101} x2={126} y2={101} stroke="var(--ink-2)" strokeWidth="1.2" strokeDasharray="2 2" />
      {/* Code row 2 */}
      <rect x={70} y={116} width={60} height={18} rx="2" fill="var(--bg-sunk)" stroke="var(--line)" strokeWidth="1" />
      <line x1={74} y1={125} x2={84} y2={125} stroke="var(--ink-3)" strokeWidth="1.2" />
      <line x1={88} y1={125} x2={126} y2={125} stroke="var(--ink-2)" strokeWidth="1.2" strokeDasharray="2 2" />
    </g>
  )
}

function CodeFields() {
  // Two stacked input fields — filled with content (dashed lines
  // representing pasted text) — and an accent confirm pill below.
  // Represents the paste-and-confirm moment of manual entry.
  return (
    <g>
      {/* Field 1 — filled */}
      <rect x={70} y={70} width={60} height={20} rx="3" fill="none" stroke="var(--ink-2)" strokeWidth="1.4" />
      <line x1={74} y1={80} x2={126} y2={80} stroke="var(--ink)" strokeWidth="1.4" strokeDasharray="2 2" />
      {/* Field 2 — filled */}
      <rect x={70} y={100} width={60} height={20} rx="3" fill="none" stroke="var(--ink-2)" strokeWidth="1.4" />
      <line x1={74} y1={110} x2={114} y2={110} stroke="var(--ink)" strokeWidth="1.4" strokeDasharray="2 2" />
      {/* Confirm pill */}
      <rect x={82} y={134} width={36} height={14} rx="7" fill="var(--accent)" />
    </g>
  )
}

const SCREENS: Record<Method, [React.ReactElement, React.ReactElement, React.ReactElement]> = {
  onetap: [<Envelope />, <TapButton />, <ConnectedCheck />],
  qr: [<LaptopWithQr />, <SettingsList />, <QrPattern />],
  // Manual entry mirrors the actual user flow: find the codes in your
  // email → navigate to Add eSIM → paste them into the form.
  // Step 2 is the same Settings navigation as the QR method (only the
  // sub-option you pick at the next screen differs, which is too small
  // to differentiate at this illustration scale).
  manual: [<EmailWithCodes />, <SettingsList />, <CodeFields />],
}

// Steps that draw their own full-frame illustration (e.g., a laptop)
// instead of the shared phone frame.
const FRAMELESS = new Set(['qr-0'])

export function StepArt({ method, step }: Props) {
  const key = `${method}-${step}`
  if (FRAMELESS.has(key)) {
    return (
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        role="img"
        aria-hidden="true"
        style={{ display: 'block', width: '100%', height: '100%' }}
      >
        {SCREENS[method][step]}
      </svg>
    )
  }
  return <PhoneFrame>{SCREENS[method][step]}</PhoneFrame>
}
