"""Analytics helpers — UA → device classification + the canonical event-type
allow-list. Intentionally tiny; the heavy lifting is the Event model + SQL
queries in routers/admin.py.
"""

from __future__ import annotations

from typing import Optional

# Whitelisted event types. Anything outside this set is rejected at /api/track
# so the table can't be polluted by a stray script tag with arbitrary `type`.
# Add a new type here when you ship a new ping.
ALLOWED_EVENT_TYPES = frozenset(
    {
        "page_view",
        "destination_view",
        "plan_clicked",
        "checkout_started",
        "coupon_applied",
        "payment_attempted",
        "payment_succeeded",
        "payment_failed",
    }
)


def device_from_user_agent(ua: Optional[str]) -> Optional[str]:
    """Crude but sufficient device classifier: 'mobile' | 'tablet' | 'desktop'.
    For analytics buckets only — don't use this for feature gating."""
    if not ua:
        return None
    ua_l = ua.lower()
    if "tablet" in ua_l or "ipad" in ua_l:
        return "tablet"
    if "mobi" in ua_l or "iphone" in ua_l or "android" in ua_l:
        # Android tablets identify as Mobile too; we accept the 95% case.
        return "mobile"
    return "desktop"


def normalize_referrer(ref: Optional[str], own_host: Optional[str]) -> Optional[str]:
    """Strip our own host from referrer so internal navs don't pollute the
    'Top traffic sources' chart. Returns None if ref is empty or self-hosted.
    """
    if not ref:
        return None
    if own_host and own_host in ref:
        return None
    return ref[:500]


def referrer_source(ref: Optional[str]) -> str:
    """Bucket a referrer URL into a human-readable source name for the
    Traffic sources chart. Anything we don't recognize → 'Other'.
    Empty/missing → 'Direct'.
    """
    if not ref:
        return "Direct"
    r = ref.lower()
    if "google." in r:
        return "Google"
    if "bing." in r:
        return "Bing"
    if "duckduckgo." in r:
        return "DuckDuckGo"
    if "twitter." in r or "t.co" in r or "x.com" in r:
        return "Twitter / X"
    if "facebook." in r or "fb.com" in r:
        return "Facebook"
    if "instagram." in r:
        return "Instagram"
    if "tiktok." in r:
        return "TikTok"
    if "reddit." in r:
        return "Reddit"
    if "linkedin." in r:
        return "LinkedIn"
    if "youtube." in r or "youtu.be" in r:
        return "YouTube"
    if "github." in r:
        return "GitHub"
    if "news.ycombinator" in r or "hn.algolia" in r:
        return "Hacker News"
    return "Other"
