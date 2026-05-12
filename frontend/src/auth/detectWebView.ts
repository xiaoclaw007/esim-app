// Embedded-webview detection. Google's OAuth blocks sign-in from
// in-app browsers (error: disallowed_useragent), so we surface a
// helpful banner + steer the customer to email/magic-link login
// when one of these is detected.
//
// We err on the side of "match a known offender" rather than a
// blanket "anything that isn't Safari/Chrome/Firefox," because
// false positives here would hide the Google button from legitimate
// browsers we don't recognize (Brave, Vivaldi, DuckDuckGo, etc.).

export type WebViewName =
  | 'WeChat'
  | 'Facebook'
  | 'Instagram'
  | 'Line'
  | 'TikTok'
  | 'Twitter'
  | 'LinkedIn'
  | 'QQ'
  | 'Snapchat'
  | 'Pinterest'

export interface WebViewMatch {
  name: WebViewName
  /** Short hint for how to escape this specific app's webview. */
  escapeHint: string
}

// Patterns ordered roughly by global usage. First match wins.
const PATTERNS: Array<{ name: WebViewName; re: RegExp; escapeHint: string }> = [
  {
    name: 'WeChat',
    re: /MicroMessenger|WindowsWechat/i,
    escapeHint: 'Tap the ⋯ in the top-right and choose "Open in Browser".',
  },
  {
    name: 'Facebook',
    re: /\bFBAV\b|\bFBAN\b|FB_IAB|FB4A/i,
    escapeHint: 'Tap the ⋯ menu and choose "Open in external browser".',
  },
  {
    name: 'Instagram',
    re: /Instagram/i,
    escapeHint: 'Tap the ⋯ menu and choose "Open in external browser".',
  },
  {
    name: 'TikTok',
    re: /BytedanceWebview|musical_ly|TikTok/i,
    escapeHint: 'Tap the ⋯ menu and choose "Open in browser".',
  },
  {
    name: 'Line',
    re: /\bLine\//i,
    escapeHint: 'Tap the menu icon and choose "Open in Safari/Browser".',
  },
  {
    name: 'Twitter',
    re: /\bTwitter\b/i,
    escapeHint: 'Tap the share icon and choose "Open in Safari/Browser".',
  },
  {
    name: 'LinkedIn',
    re: /LinkedInApp/i,
    escapeHint: 'Tap the ⋯ menu and choose "Open in browser".',
  },
  {
    name: 'QQ',
    re: /\bQQ\//i,
    escapeHint: 'Tap the ⋯ menu and choose "Open in Browser".',
  },
  {
    name: 'Snapchat',
    re: /Snapchat/i,
    escapeHint: 'Tap the ⋯ menu and choose "Open in browser".',
  },
  {
    name: 'Pinterest',
    re: /Pinterest/i,
    escapeHint: 'Tap the ⋯ menu and choose "Open in browser".',
  },
]

/** Returns the matched webview if the current UA looks like an
 *  embedded in-app browser; otherwise null. */
export function detectWebView(): WebViewMatch | null {
  if (typeof navigator === 'undefined') return null
  const ua = navigator.userAgent || ''
  for (const p of PATTERNS) {
    if (p.re.test(ua)) {
      return { name: p.name, escapeHint: p.escapeHint }
    }
  }
  return null
}
