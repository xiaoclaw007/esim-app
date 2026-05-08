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
  // A laptop sketched outside the phone screen (left side) showing a
  // QR code; the phone is "looking at it" via the camera. Composes the
  // two devices in one illustration.
  return (
    <g>
      {/* Override: draw laptop OUTSIDE the screen rect, at viewBox left */}
      {/* Laptop screen */}
      <rect x={10} y={70} width={42} height={32} rx="2" fill="var(--bg-elev)" stroke="var(--ink)" strokeWidth="1.4" />
      {/* QR pattern simplified — 3x3 corner squares + dots */}
      <rect x={14} y={74} width={6} height={6} fill="var(--ink)" />
      <rect x={42} y={74} width={6} height={6} fill="var(--ink)" />
      <rect x={14} y={92} width={6} height={6} fill="var(--ink)" />
      <rect x={24} y={80} width={2} height={2} fill="var(--ink)" />
      <rect x={28} y={84} width={2} height={2} fill="var(--ink)" />
      <rect x={32} y={88} width={2} height={2} fill="var(--ink)" />
      <rect x={36} y={92} width={2} height={2} fill="var(--ink)" />
      {/* Laptop base */}
      <path d="M6 102 L56 102 L52 108 L10 108 Z" fill="var(--bg-elev)" stroke="var(--ink)" strokeWidth="1.4" strokeLinejoin="round" />
      {/* Connection arc from laptop to phone */}
      <path
        d="M52 88 Q 60 70 80 80"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.4"
        strokeDasharray="3 3"
      />
      {/* Inside phone screen: camera viewfinder */}
      <path d="M70 60 L70 50 L80 50" fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M120 50 L130 50 L130 60" fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M70 130 L70 140 L80 140" fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M120 140 L130 140 L130 130" fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" />
      {/* Center dot */}
      <circle cx={100} cy={95} r={3} fill="var(--accent)" />
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
  // A QR code pattern + scanning corner brackets (camera viewfinder).
  return (
    <g>
      {/* Viewfinder corner brackets */}
      <path d="M68 56 L68 50 L74 50" fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M126 50 L132 50 L132 56" fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M68 124 L68 130 L74 130" fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M126 130 L132 130 L132 124" fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" />
      {/* QR-ish pattern inside */}
      <rect x={76} y={58} width={10} height={10} fill="var(--ink)" />
      <rect x={114} y={58} width={10} height={10} fill="var(--ink)" />
      <rect x={76} y={112} width={10} height={10} fill="var(--ink)" />
      <rect x={92} y={66} width={3} height={3} fill="var(--ink)" />
      <rect x={102} y={72} width={3} height={3} fill="var(--ink)" />
      <rect x={112} y={86} width={3} height={3} fill="var(--ink)" />
      <rect x={92} y={92} width={3} height={3} fill="var(--ink)" />
      <rect x={104} y={100} width={3} height={3} fill="var(--ink)" />
      <rect x={88} y={110} width={3} height={3} fill="var(--ink)" />
      <rect x={114} y={108} width={3} height={3} fill="var(--ink)" />
      {/* Scan line */}
      <line x1={70} y1={92} x2={130} y2={92} stroke="var(--accent)" strokeWidth="1.2" opacity="0.7" />
    </g>
  )
}

function CodeFields() {
  // Two stacked input fields — represents the SM-DP+ address and
  // activation code from the activation email. Just shapes, no
  // simulated text bars.
  return (
    <g>
      {/* Field 1 */}
      <rect x={70} y={70} width={60} height={20} rx="3" fill="none" stroke="var(--ink-2)" strokeWidth="1.4" />
      {/* Field 2 */}
      <rect x={70} y={100} width={60} height={20} rx="3" fill="none" stroke="var(--ink-2)" strokeWidth="1.4" />
      {/* Confirm pill */}
      <rect x={82} y={134} width={36} height={14} rx="7" fill="var(--accent)" />
    </g>
  )
}

function CursorTyping() {
  // Single field with a blinking accent cursor — the typing moment.
  return (
    <g>
      {/* Highlighted active field with cursor */}
      <rect x={70} y={84} width={60} height={24} rx="4" fill="none" stroke="var(--accent)" strokeWidth="1.8" />
      <line x1={102} y1={88} x2={102} y2={104} stroke="var(--accent)" strokeWidth="2">
        <animate attributeName="opacity" values="1;0;1" dur="1.1s" repeatCount="indefinite" />
      </line>
      {/* Field below, untouched */}
      <rect x={70} y={120} width={60} height={20} rx="3" fill="none" stroke="var(--line-strong)" strokeWidth="1.2" />
    </g>
  )
}

const SCREENS: Record<Method, [React.ReactElement, React.ReactElement, React.ReactElement]> = {
  onetap: [<Envelope />, <TapButton />, <ConnectedCheck />],
  qr: [<LaptopWithQr />, <SettingsList />, <QrPattern />],
  manual: [<CodeFields />, <CursorTyping />, <ConnectedCheck />],
}

export function StepArt({ method, step }: Props) {
  return <PhoneFrame>{SCREENS[method][step]}</PhoneFrame>
}
