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
  // Email envelope at top of screen with a subtle "open" tab and a
  // small pill button below — represents "open email, see install".
  return (
    <g>
      {/* Envelope body */}
      <rect x={68} y={50} width={64} height={36} rx="3" fill="none" stroke="var(--ink)" strokeWidth="1.4" />
      <path d="M68 56 L100 74 L132 56" fill="none" stroke="var(--ink)" strokeWidth="1.4" />
      {/* Eyebrow line under envelope */}
      <line x1={68} y1={98} x2={120} y2={98} stroke="var(--ink-3)" strokeWidth="1.2" />
      <line x1={68} y1={106} x2={108} y2={106} stroke="var(--ink-3)" strokeWidth="1.2" />
      {/* Install button */}
      <rect x={68} y={122} width={64} height={20} rx="10" fill="var(--accent)" />
      <text
        x={100}
        y={135.5}
        textAnchor="middle"
        fontFamily="var(--font)"
        fontSize="9"
        fill="var(--bg)"
        fontWeight="500"
      >
        Install
      </text>
    </g>
  )
}

function TapButton() {
  // A chunky pill labelled "Install" with a tap ripple radiating out.
  return (
    <g>
      {/* Eyebrow text bars */}
      <line x1={68} y1={50} x2={120} y2={50} stroke="var(--ink-3)" strokeWidth="1.2" />
      <line x1={68} y1={58} x2={108} y2={58} stroke="var(--ink-3)" strokeWidth="1.2" />
      {/* The button */}
      <rect x={68} y={82} width={64} height={26} rx="13" fill="var(--accent)" />
      <text
        x={100}
        y={98.5}
        textAnchor="middle"
        fontFamily="var(--font)"
        fontSize="10"
        fill="var(--bg)"
        fontWeight="500"
      >
        Install
      </text>
      {/* Tap ripples */}
      <circle cx={100} cy={95} r={28} fill="none" stroke="var(--accent)" strokeWidth="1" opacity="0.4" />
      <circle cx={100} cy={95} r={36} fill="none" stroke="var(--accent)" strokeWidth="1" opacity="0.18" />
      {/* Continue/done bars */}
      <line x1={72} y1={130} x2={128} y2={130} stroke="var(--ink-3)" strokeWidth="1.2" />
      <line x1={72} y1={138} x2={116} y2={138} stroke="var(--ink-3)" strokeWidth="1.2" />
    </g>
  )
}

function ConnectedCheck() {
  // Big check + signal bars + "Connected" pill — the success state.
  return (
    <g>
      {/* Signal bars top-right */}
      <rect x={120} y={42} width={3} height={4} fill="var(--ink-2)" />
      <rect x={125} y={40} width={3} height={6} fill="var(--ink-2)" />
      <rect x={130} y={38} width={3} height={8} fill="var(--ink-2)" />
      {/* Big circle with check */}
      <circle cx={100} cy={88} r={18} fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="1.6" />
      <path
        d="M91 88 L98 95 L110 81"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Status pill */}
      <rect x={74} y={120} width={52} height={16} rx="8" fill="none" stroke="var(--ink-2)" strokeWidth="1.2" />
      <text
        x={100}
        y={131}
        textAnchor="middle"
        fontFamily="var(--font)"
        fontSize="8"
        fill="var(--ink)"
        fontWeight="500"
      >
        Connected
      </text>
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
  // Two stacked input fields on the screen — represents the SM-DP+
  // address and activation code shown in the activation email.
  return (
    <g>
      {/* Header */}
      <line x1={68} y1={48} x2={108} y2={48} stroke="var(--ink)" strokeWidth="1.6" />
      {/* Field 1 label + input */}
      <line x1={68} y1={62} x2={92} y2={62} stroke="var(--ink-3)" strokeWidth="1" />
      <rect x={68} y={68} width={64} height={14} rx="2" fill="none" stroke="var(--line-strong)" strokeWidth="1" />
      <line x1={72} y1={75} x2={104} y2={75} stroke="var(--mono-fg, var(--ink))" strokeWidth="1.2" strokeDasharray="2 2" />
      {/* Field 2 label + input */}
      <line x1={68} y1={94} x2={92} y2={94} stroke="var(--ink-3)" strokeWidth="1" />
      <rect x={68} y={100} width={64} height={14} rx="2" fill="none" stroke="var(--line-strong)" strokeWidth="1" />
      <line x1={72} y1={107} x2={104} y2={107} stroke="var(--ink)" strokeWidth="1.2" strokeDasharray="2 2" />
      {/* Confirm button */}
      <rect x={84} y={128} width={32} height={14} rx="7" fill="var(--accent)" />
    </g>
  )
}

function CursorTyping() {
  // Single field with a blinking text cursor / typing animation hint.
  return (
    <g>
      <line x1={68} y1={50} x2={120} y2={50} stroke="var(--ink)" strokeWidth="1.6" />
      <line x1={68} y1={66} x2={92} y2={66} stroke="var(--ink-3)" strokeWidth="1" />
      {/* Highlighted field with cursor */}
      <rect x={68} y={72} width={64} height={20} rx="3" fill="none" stroke="var(--accent)" strokeWidth="1.6" />
      <line x1={74} y1={78} x2={96} y2={78} stroke="var(--ink)" strokeWidth="1.4" strokeDasharray="2 2" />
      <line x1={98} y1={76} x2={98} y2={88} stroke="var(--accent)" strokeWidth="1.6" />
      {/* Field below, untouched */}
      <line x1={68} y1={104} x2={92} y2={104} stroke="var(--ink-3)" strokeWidth="1" />
      <rect x={68} y={110} width={64} height={20} rx="3" fill="none" stroke="var(--line-strong)" strokeWidth="1" />
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
