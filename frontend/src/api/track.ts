// Lightweight event tracker. Fire-and-forget POST to /api/track for
// analytics events the admin dashboard slices/dices.
//
// Design notes:
//  * Session ID is generated once per browser tab and stored in sessionStorage.
//    Distinct visits = distinct session ids. We don't need cookies or
//    persistent ids — the admin asked for "real-ish" funnels, not deduped
//    cross-visit users.
//  * All errors are swallowed: tracking must never block UX.
//  * If the navigator goes offline or the call fails, the event is dropped.
//    We do NOT queue/retry — a perfect funnel isn't worth the complexity.
//  * sendBeacon-style send for unloads isn't needed since we ping eagerly
//    on navigation.

import { apiFetch } from './client'

const SESSION_KEY = 'nimvoy.sid'

function getSessionId(): string {
  if (typeof window === 'undefined') return ''
  let sid = sessionStorage.getItem(SESSION_KEY)
  if (!sid) {
    sid = generateSessionId()
    sessionStorage.setItem(SESSION_KEY, sid)
  }
  return sid
}

function generateSessionId(): string {
  // crypto.randomUUID() is available in all browsers we care about (Chrome 92+,
  // Safari 15.4+, Firefox 95+) — falls back to a Math.random hex if missing.
  try {
    return (crypto as Crypto & { randomUUID?: () => string }).randomUUID?.() ??
      `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  }
}

export type EventType =
  | 'page_view'
  | 'destination_view'
  | 'plan_clicked'
  | 'checkout_started'
  | 'coupon_applied'
  | 'payment_attempted'
  | 'payment_succeeded'
  | 'payment_failed'

export interface TrackPayload {
  [key: string]: string | number | boolean | null | undefined
}

export function track(type: EventType, metadata?: TrackPayload): void {
  if (typeof window === 'undefined') return
  const body = {
    type,
    session_id: getSessionId(),
    path: window.location.pathname + window.location.search,
    referrer: document.referrer || null,
    metadata: metadata ?? null,
  }
  // Fire-and-forget. We don't await; we also catch and silently drop so
  // a 4xx during dev (e.g., unknown event type) doesn't bubble to the user.
  apiFetch('/api/track', {
    method: 'POST',
    body: JSON.stringify(body),
  }).catch(() => {
    /* swallow */
  })
}
