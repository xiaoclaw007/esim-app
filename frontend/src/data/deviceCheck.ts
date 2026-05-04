// Device compatibility check for the landing-page "Does your phone
// support eSIM?" widget. Two pieces:
//
// 1. checkDevice(query): pattern-matches a free-text phone name against
//    known eSIM-capable model families (iPhone, Pixel, Samsung Galaxy
//    S/Note/Z, iPad with cellular). Returns a compatibility verdict plus
//    feature flags (dual eSIM, 5G).
//
// 2. detectFromUserAgent(): tries to pre-fill the input with the
//    visitor's actual device. iOS hides the model so we only get
//    "iPhone"; Android UAs commonly include the model code.

export type CheckStatus = 'compatible' | 'incompatible' | 'unknown'

export interface DeviceCheckResult {
  status: CheckStatus
  brand?: string
  model?: string
  /** Short feature tags, e.g. ["Dual eSIM", "5G", "Hotspot"]. */
  notes: string[]
  /** A one-line human message to show below the verdict. */
  message: string
}

export function checkDevice(rawQuery: string): DeviceCheckResult {
  const q = rawQuery.trim().toLowerCase().replace(/[^a-z0-9 +]/g, ' ').replace(/\s+/g, ' ')
  if (!q) {
    return {
      status: 'unknown',
      notes: [],
      message: 'Type your phone model above to check — e.g. "iPhone 14", "Pixel 8", "Galaxy S23".',
    }
  }
  if (q.includes('iphone')) return checkIphone(q)
  if (q.includes('ipad')) return checkIpad(q)
  if (q.includes('pixel')) return checkPixel(q)
  if (
    q.includes('galaxy') ||
    /\bnote\s*\d/.test(q) ||
    /\bs\s*\d{2}\b/.test(q) ||
    q.includes('z fold') ||
    q.includes('z flip')
  )
    return checkSamsung(q)
  return {
    status: 'unknown',
    notes: [],
    message:
      "Not in our quick lookup. Open Settings on your phone — if you see \"Add eSIM\" under Cellular / Mobile Network / SIMs, you're good to go.",
  }
}

function checkIphone(q: string): DeviceCheckResult {
  // Match: iPhone (XR|XS|SE|<num>) (Pro|Max|Plus|Mini)?
  const m = q.match(/iphone\s*(xr|xs|se|\d+)\s*(pro|max|plus|mini)?/i)
  if (!m) {
    return {
      status: 'unknown',
      notes: ['iOS'],
      message:
        'Most iPhones from XR / XS (2018) onward support eSIM. Check Settings → Cellular → Add eSIM to confirm.',
    }
  }
  const num = m[1].toLowerCase()
  const variant = m[2] ? ' ' + m[2][0].toUpperCase() + m[2].slice(1) : ''
  const display = `iPhone ${num === 'xr' ? 'XR' : num === 'xs' ? 'XS' : num === 'se' ? 'SE' : num}${variant}`

  // iPhone X (10) was 2017 — no eSIM. XR / XS (2018) onwards all support it.
  if (num === 'xr' || num === 'xs' || num === 'se') {
    const notes = ['eSIM supported', 'Hotspot']
    return {
      status: 'compatible',
      brand: 'Apple',
      model: display,
      notes,
      message: 'Compatible with Nimvoy.',
    }
  }
  const ver = parseInt(num, 10)
  if (Number.isNaN(ver) || ver <= 10) {
    return {
      status: 'incompatible',
      brand: 'Apple',
      model: display,
      notes: [],
      message:
        "Older iPhones don't support eSIM. iPhone XR / XS (2018) is the oldest compatible model.",
    }
  }
  // ver >= 11 — all eSIM-capable. 12+ adds 5G; 13+ adds dual eSIM.
  const notes = ['eSIM supported']
  if (ver >= 13) notes.push('Dual eSIM')
  if (ver >= 12) notes.push('5G')
  notes.push('Hotspot')
  return { status: 'compatible', brand: 'Apple', model: display, notes, message: 'Compatible with Nimvoy.' }
}

function checkIpad(q: string): DeviceCheckResult {
  // iPads with eSIM: any cellular iPad from 2018 onward (iPad Pro 3rd gen,
  // iPad Air 3+, iPad Mini 5+, regular iPad 7+). Wi-Fi-only iPads can't.
  const m = q.match(/ipad\s*(pro|air|mini)?\s*(\d+)?/i)
  const variant = m && m[1] ? ' ' + m[1][0].toUpperCase() + m[1].slice(1) : ''
  const display = `iPad${variant}`
  return {
    status: 'compatible',
    brand: 'Apple',
    model: display,
    notes: ['eSIM supported (Wi-Fi + Cellular models only)', '5G on Pro 5th gen+'],
    message: 'Cellular iPads from 2018 onward support eSIM. Wi-Fi-only iPads do not.',
  }
}

function checkPixel(q: string): DeviceCheckResult {
  const m = q.match(/pixel\s*(\d+)\s*(pro|xl|a)?/i)
  if (!m) {
    return {
      status: 'unknown',
      notes: ['Android'],
      message: 'All Google Pixel 3 and later support eSIM.',
    }
  }
  const num = parseInt(m[1], 10)
  const variant = m[2] ? ' ' + m[2][0].toUpperCase() + m[2].slice(1) : ''
  const display = `Pixel ${num}${variant}`
  if (num >= 3) {
    const notes = ['eSIM supported', 'Hotspot']
    if (num >= 5) notes.push('5G')
    return { status: 'compatible', brand: 'Google', model: display, notes, message: 'Compatible with Nimvoy.' }
  }
  return {
    status: 'incompatible',
    brand: 'Google',
    model: display,
    notes: [],
    message: "Pixel 1 and 2 don't support eSIM. Pixel 3 (2018) is the oldest compatible model.",
  }
}

function checkSamsung(q: string): DeviceCheckResult {
  // Galaxy S — S20 (2020) onwards support eSIM (US/global variants vary;
  // we report the most common case). Note 20+, all Z Fold/Flip too.
  let display = 'Galaxy device'
  let supported = false
  let fiveG = false
  let dual = false

  const sMatch = q.match(/(?:galaxy\s*)?s\s*(\d{2})\s*(plus|ultra|fe)?/i)
  if (sMatch) {
    const num = parseInt(sMatch[1], 10)
    const variant = sMatch[2] ? ' ' + sMatch[2][0].toUpperCase() + sMatch[2].slice(1) : ''
    display = `Galaxy S${num}${variant}`
    if (num >= 20) {
      supported = true
      fiveG = true
    }
  }
  const noteMatch = q.match(/note\s*(\d{1,2})/i)
  if (noteMatch) {
    const num = parseInt(noteMatch[1], 10)
    display = `Galaxy Note ${num}`
    if (num >= 20) {
      supported = true
      fiveG = true
    }
  }
  if (q.includes('z fold') || q.includes('z flip')) {
    display = q.includes('z fold') ? 'Galaxy Z Fold' : 'Galaxy Z Flip'
    supported = true
    fiveG = true
    dual = true
  }
  if (q.includes('a54') || q.includes('a55') || q.includes('a35')) {
    display = q.includes('a54') ? 'Galaxy A54' : q.includes('a55') ? 'Galaxy A55' : 'Galaxy A35'
    supported = true
    fiveG = true
  }

  if (supported) {
    const notes = ['eSIM supported', 'Hotspot']
    if (fiveG) notes.push('5G')
    if (dual) notes.push('Dual eSIM')
    return { status: 'compatible', brand: 'Samsung', model: display, notes, message: 'Compatible with Nimvoy.' }
  }
  if (display !== 'Galaxy device') {
    return {
      status: 'incompatible',
      brand: 'Samsung',
      model: display,
      notes: [],
      message: 'eSIM requires Galaxy S20 / Note 20 (2020) or later. Older Galaxys are physical-SIM only.',
    }
  }
  return {
    status: 'unknown',
    notes: ['Android'],
    message: 'Galaxy S20 / Note 20 / Z Fold / Z Flip and most Galaxy A-series from 2023 support eSIM.',
  }
}

// User-Agent sniff to pre-fill the input. Best-effort; iOS deliberately
// hides the model so we can only return "iPhone" / "iPad" generically.
export function detectFromUserAgent(): string {
  if (typeof navigator === 'undefined') return ''
  const ua = navigator.userAgent
  if (/iPad/.test(ua)) return 'iPad'
  if (/iPhone/.test(ua)) return 'iPhone'
  // Android UAs typically look like:
  //   Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UD1A.231105.004) ...
  //   Mozilla/5.0 (Linux; Android 14; SM-S908U Build/UP1A.231005.007) ...
  const m = ua.match(/Android[^;)]*;\s*([^)]+?)(?:\s*Build|\)|;)/)
  if (m) {
    const model = m[1].trim()
    // Pixel: extract the bit that includes the word "Pixel"
    const pixel = model.match(/Pixel\s*\d+\w*/i)
    if (pixel) return pixel[0]
    // SM-XXX Samsung codes — leave as-is so the user can edit if desired
    if (/^SM-/.test(model)) return model
    return model
  }
  return ''
}
