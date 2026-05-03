"""IP → ISO-2 country code lookup.

Wraps MaxMind GeoLite2-Country (free, ~6MB, ships as a .mmdb file). In dev
or before the DB is installed this returns None for every lookup — analytics
keep working, the country chart just shows "unknown" for everyone.

Install:
  1. Download GeoLite2-Country.mmdb from https://www.maxmind.com/ (free
     account → "GeoIP2 Downloads") OR use the IPinfo-mirrored copy at
     https://github.com/P3TERX/GeoLite.mmdb/releases.
  2. Drop it at backend/data/GeoLite2-Country.mmdb (or set GEOIP_DB_PATH in
     env).
  3. pip install geoip2  (already listed in requirements.txt — see V1
     analytics PR).

Test mode: pass a private/loopback IP (127.0.0.1, 10.x, 192.168.x) — we
short-circuit and return None so local dev doesn't see "unknown" rows
attributed to wherever the test IP geolocates.
"""

from __future__ import annotations

import ipaddress
import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

# Lazily-initialized reader — None until first lookup. Two reasons:
#   - import-time failure of geoip2 (not installed) shouldn't crash the app.
#   - DB file may not exist in dev; fall back to no-op.
_reader = None
_reader_initialized = False


def _get_reader():
    global _reader, _reader_initialized
    if _reader_initialized:
        return _reader
    _reader_initialized = True

    db_path = os.environ.get("GEOIP_DB_PATH", "data/GeoLite2-Country.mmdb")
    if not os.path.exists(db_path):
        logger.info(
            "GeoIP DB not found at %s — country enrichment disabled. "
            "Drop GeoLite2-Country.mmdb there to enable.",
            db_path,
        )
        return None

    try:
        import geoip2.database  # type: ignore

        _reader = geoip2.database.Reader(db_path)
        logger.info("GeoIP reader initialized from %s", db_path)
    except ImportError:
        logger.warning("geoip2 package not installed — country enrichment disabled")
    except Exception as e:
        logger.warning("GeoIP reader init failed: %s", e)
    return _reader


def _is_private(ip_str: str) -> bool:
    try:
        ip = ipaddress.ip_address(ip_str)
        return ip.is_private or ip.is_loopback or ip.is_link_local
    except ValueError:
        return True


def country_for_ip(ip: Optional[str]) -> Optional[str]:
    """Look up the ISO-2 country code for an IP. Returns None on any miss
    (no DB installed, private IP, lookup failure)."""
    if not ip or _is_private(ip):
        return None
    reader = _get_reader()
    if reader is None:
        return None
    try:
        resp = reader.country(ip)
        return resp.country.iso_code
    except Exception:
        # Most common: AddressNotFoundError for IPs not in the DB.
        return None
