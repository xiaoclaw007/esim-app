"""Email delivery via AWS SES — payment confirmation and QR code delivery."""

import base64
import io
import logging
from email.mime.image import MIMEImage
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from urllib.parse import quote as _url_quote

import boto3
import qrcode
from jinja2 import Template

from app.config import settings


def _apple_install_url(lpa: str) -> str:
    """Build Apple's universal eSIM install link from an LPA activation string.

    On iOS 17.4+ / iPadOS 17.4+, tapping this URL opens Settings → Add eSIM
    with the activation code prefilled. On older iOS it opens a Safari
    helper page; on Android it fails through silently (we still show the QR).
    """
    return f"https://esimsetup.apple.com/esim_qrcode_provisioning?carddata={_url_quote(lpa, safe='')}"


def _android_install_url(lpa: str) -> str:
    """Build Android's universal eSIM install link from an LPA activation string.

    Mirrors Apple's format with a different host. Works on Android 10+ with
    a recent Google Play Services / GMS — the system "SIM Manager" intercepts
    the URL and opens the Add eSIM flow with the activation code prefilled.
    Confirmed clean on Pixel/Samsung/OPPO; flakier on Xiaomi/Vivo. Triggering
    from inside WhatsApp may not work — we still show the QR as a fallback.

    Note: there is no official Google documentation for this URL; the format
    is a de-facto industry standard adopted by major eSIM resellers (eSIM Go,
    eSIM Access, Roamic, etc.). If Google ever publishes its own scheme, this
    one-liner is where it gets updated.
    """
    return f"https://esimsetup.android.com/esim_qrcode_provisioning?carddata={_url_quote(lpa, safe='')}"

logger = logging.getLogger(__name__)


# --- Payment Confirmation Email ---
# Same postcard aesthetic as the QR delivery email — stamp, italic
# Instrument Serif headline, hand-signed sign-off, monospace meta strip.
# Distinct beat though: this lands seconds after the customer hits Pay,
# BEFORE the QR is provisioned. Tone is "we got it, eSIM is brewing."

PAYMENT_CONFIRMATION_TEMPLATE = Template("""
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Payment received — your {{ country_name }} eSIM is provisioning</title>
<style>
body { margin: 0; padding: 40px 24px; background: #F1EFE6; font-family: -apple-system, BlinkMacSystemFont, Georgia, serif; color: #16382A; }
.wrap { max-width: 620px; margin: 0 auto; }
.card { background: #FBFAF5; border: 1px solid #D9D6C6; box-shadow: 0 20px 60px rgba(22,56,42,.14); overflow: hidden; border-radius: 4px; position: relative; }
.card::before { content: ''; position: absolute; inset: 6px; border: 1px solid #D9D6C6; pointer-events: none; border-radius: 2px; }
.stamp { position: absolute; top: 30px; right: 30px; width: 92px; height: 116px; background: #FBFAF5; border: 2px dashed #16382A; padding: 6px; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: space-between; transform: rotate(3deg); z-index: 2; }
.stamp .crest { width: 52px; height: 52px; border-radius: 50%; background: #C4633A; display: flex; align-items: center; justify-content: center; color: #FBFAF5; font-family: Georgia, serif; font-style: italic; font-size: 22px; font-weight: 700; }
.stamp .denom { font-family: ui-monospace, Menlo, monospace; font-size: 9px; letter-spacing: 0.15em; color: #16382A; text-transform: uppercase; text-align: center; line-height: 1.3; }
.inner { padding: 56px 54px; position: relative; z-index: 0; }
.eyebrow { font-family: ui-monospace, Menlo, monospace; font-size: 10px; letter-spacing: 0.25em; text-transform: uppercase; color: #7B8E82; margin-bottom: 28px; }
h1 { font-family: 'Instrument Serif', 'Playfair Display', Georgia, serif; font-style: italic; font-weight: 400; font-size: 56px; line-height: 1.02; letter-spacing: -0.02em; margin: 0 0 18px 0; color: #16382A; max-width: 14ch; }
.signature { font-family: 'Instrument Serif', Georgia, serif; font-style: italic; font-size: 28px; color: #C4633A; margin-top: 8px; transform: rotate(-2deg); display: inline-block; }
.letter { font-size: 16px; line-height: 1.65; color: #375948; max-width: 48ch; font-family: Georgia, serif; }
.letter em { color: #16382A; font-style: italic; }
/* Status card — equivalent of one-tap card slot in the QR email. Sits
   between the letter and the receipt strip. */
.status-section { margin-top: 36px; padding: 22px 24px 24px; background: #FBFAF5; border: 1px solid #D9D6C6; border-radius: 6px; text-align: center; }
.status-eyebrow { font-family: ui-monospace, Menlo, monospace; font-size: 10px; letter-spacing: 0.25em; text-transform: uppercase; color: #7B8E82; margin: 0 0 6px 0; }
.status-h4 { font-family: 'Instrument Serif', Georgia, serif; font-style: italic; font-weight: 400; font-size: 22px; color: #16382A; margin: 0 0 8px 0; }
.status-sub { text-align: center; font-size: 14px; color: #375948; line-height: 1.55; margin: 0 auto; max-width: 42ch; }
.status-pulse { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #C4633A; margin-right: 8px; vertical-align: middle; }
.meta-tbl { width: 100%; border-collapse: separate; border-spacing: 1px; background: #D9D6C6; margin-top: 32px; border: 1px solid #D9D6C6; }
.meta-tbl td { background: #FBFAF5; padding: 14px 12px; vertical-align: top; width: 25%; }
.meta-tbl small { font-family: ui-monospace, Menlo, monospace; font-size: 9px; letter-spacing: 0.2em; text-transform: uppercase; color: #7B8E82; display: block; margin-bottom: 4px; }
.meta-tbl b { font-family: 'Instrument Serif', Georgia, serif; font-style: italic; font-weight: 400; font-size: 22px; color: #16382A; letter-spacing: -0.01em; }
.meta-tbl .ref { font-family: ui-monospace, Menlo, monospace; font-style: normal; font-size: 12px; letter-spacing: 0.05em; color: #16382A; }
.footer { text-align: center; padding: 20px 24px; font-family: ui-monospace, Menlo, monospace; font-size: 10px; letter-spacing: 0.2em; color: #7B8E82; text-transform: uppercase; }
.footer a { color: #7B8E82; text-decoration: none; }
</style>
</head>
<body>
<div class="wrap">
  <div class="card">
    <div class="stamp">
      <div class="crest">N</div>
      <div class="denom">Nimvoy · {{ stamp_iso3 }}<br>{{ stamp_year }}</div>
    </div>

    <div class="inner">
      <div class="eyebrow">A receipt from Nimvoy — order {{ reference }}</div>

      <h1>Postage paid.<br><span style="font-style:normal;color:#C4633A">eSIM brewing.</span></h1>

      <p class="letter">
        Your <em>${{ amount_display }}</em> has cleared, and we're now whispering quietly to our
        network partners to wake up your {{ country_name }} eSIM. The QR lands in your inbox in
        about a minute — keep an eye out, that's the one you'll scan.
      </p>
      <p class="letter" style="margin-top:14px">
        Nothing for you to do right now. We'll take it from here.
      </p>
      <div class="signature">— Nimvoy</div>

      <div class="status-section">
        <p class="status-eyebrow"><span class="status-pulse"></span>Provisioning</p>
        <h4 class="status-h4">QR code on the way</h4>
        <p class="status-sub">Typically lands in under 60 seconds. We'll send a separate email with your QR code and one-tap install links.</p>
      </div>

      <table class="meta-tbl" role="presentation" cellpadding="0" cellspacing="0">
        <tr>
          <td><small>Plan</small><b>{{ plan_short }}</b></td>
          <td><small>Days</small><b>{{ validity_days }}</b></td>
          <td><small>Paid</small><b>${{ amount_display }}</b></td>
          <td><small>Order</small><b class="ref">{{ reference }}</b></td>
        </tr>
      </table>
    </div>
  </div>

  <div class="footer">
    <a href="https://www.nimvoy.com/order/{{ reference }}">View in browser</a> ·
    <a href="mailto:support@nimvoy.com">support@nimvoy.com</a><br><br>
    Nimvoy · Global eSIM
  </div>
</div>
</body>
</html>
""")


def send_payment_confirmation_email(
    to_email: str,
    reference: str,
    plan_name: str,
    amount_cents: int,
    country: str = "",
    data_gb: int | None = None,
    validity_days: int | None = None,
) -> bool:
    """Send a payment confirmation email immediately after Stripe payment.

    This gives the customer immediate reassurance in the seconds between
    "card charged" and "QR delivery email landing." Same postcard look as
    the QR email; the country/data/days args drive the stamp + meta strip.
    All three are optional so older callers don't break — they just get a
    sparser meta strip.
    """
    try:
        from datetime import datetime as _dt

        meta = _country_meta(country)
        country_name = meta["name"]
        now = _dt.now()

        # Compact plan label for the meta strip — prefer "5 GB" if we have
        # the data figure, fall back to the full plan name truncated.
        plan_short = (
            _format_data_amount(data_gb) if data_gb is not None else (plan_name or "—")
        )

        html_body = PAYMENT_CONFIRMATION_TEMPLATE.render(
            reference=reference,
            country_name=country_name,
            stamp_iso3=meta["iso3"],
            stamp_year=now.year,
            plan_short=plan_short,
            validity_days=validity_days if validity_days is not None else "—",
            amount_display=f"{amount_cents / 100:.2f}",
        )

        ses_client = boto3.client(
            "ses",
            region_name=settings.aws_region,
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
        )
        ses_client.send_email(
            Source=settings.aws_ses_from_email,
            Destination={"ToAddresses": [to_email]},
            Message={
                "Subject": {
                    "Data": f"Payment received — your {country_name} eSIM is on the way ✦ {reference}"
                },
                "Body": {"Html": {"Data": html_body}},
            },
        )

        logger.info(f"Payment confirmation email sent to {to_email} for {reference}")
        return True

    except Exception as e:
        logger.error(f"Failed to send payment confirmation to {to_email}: {e}")
        return False

# HTML email template for QR code delivery — "Postcard" direction.
# Visual reference: design_handoff_activation_email/postcard.html
#
# Email-client notes from the handoff README:
#   - Apple Mail / iOS Mail / modern Gmail / Outlook 365 web all render this
#     accurately.
#   - Outlook Desktop (Windows MSO) won't honor CSS transforms, so the stamp,
#     postmark, and signature lose their rotation. The postcard still reads.
#   - We use a <table> for the meta strip below so MSO doesn't break the grid.
#   - QR is a CID-attached PNG (Gmail strips inline SVG).
EMAIL_TEMPLATE = Template("""
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>{{ country_name }} is calling — your Nimvoy eSIM is ready</title>
<style>
body { margin: 0; padding: 40px 24px; background: #F1EFE6; font-family: -apple-system, BlinkMacSystemFont, Georgia, serif; color: #16382A; }
.wrap { max-width: 620px; margin: 0 auto; }
.card { background: #FBFAF5; border: 1px solid #D9D6C6; box-shadow: 0 20px 60px rgba(22,56,42,.14); overflow: hidden; border-radius: 4px; position: relative; }
.card::before { content: ''; position: absolute; inset: 6px; border: 1px solid #D9D6C6; pointer-events: none; border-radius: 2px; }
.stamp { position: absolute; top: 30px; right: 30px; width: 92px; height: 116px; background: #FBFAF5; border: 2px dashed #16382A; padding: 6px; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: space-between; transform: rotate(3deg); z-index: 2; }
.stamp .crest { width: 52px; height: 52px; border-radius: 50%; background: #C4633A; display: flex; align-items: center; justify-content: center; color: #FBFAF5; font-family: Georgia, serif; font-style: italic; font-size: 22px; font-weight: 700; }
.stamp .denom { font-family: ui-monospace, Menlo, monospace; font-size: 9px; letter-spacing: 0.15em; color: #16382A; text-transform: uppercase; text-align: center; line-height: 1.3; }
.inner { padding: 56px 54px; position: relative; z-index: 0; }
.eyebrow { font-family: ui-monospace, Menlo, monospace; font-size: 10px; letter-spacing: 0.25em; text-transform: uppercase; color: #7B8E82; margin-bottom: 28px; }
h1 { font-family: 'Instrument Serif', 'Playfair Display', Georgia, serif; font-style: italic; font-weight: 400; font-size: 56px; line-height: 1.02; letter-spacing: -0.02em; margin: 0 0 18px 0; color: #16382A; max-width: 12ch; }
.signature { font-family: 'Instrument Serif', Georgia, serif; font-style: italic; font-size: 28px; color: #C4633A; margin-top: 8px; transform: rotate(-2deg); display: inline-block; }
.letter { font-size: 16px; line-height: 1.65; color: #375948; max-width: 48ch; font-family: Georgia, serif; }
.letter em { color: #16382A; font-style: italic; }
/* One-tap install — primary path, sits above the QR card. Buttons stack
   vertically so each is full-width and visually identical (no wrap-shape
   mismatch between IPHONE / ANDROID). */
.tap-section { margin-top: 36px; padding: 22px 24px 24px; background: #FBFAF5; border: 1px solid #D9D6C6; border-radius: 6px; }
.tap-eyebrow { font-family: ui-monospace, Menlo, monospace; font-size: 10px; letter-spacing: 0.25em; text-transform: uppercase; color: #7B8E82; text-align: center; margin: 0 0 6px 0; }
.tap-h4 { font-family: 'Instrument Serif', Georgia, serif; font-style: italic; font-weight: 400; font-size: 22px; color: #16382A; text-align: center; margin: 0 0 6px 0; }
.tap-sub { text-align: center; font-size: 13px; color: #7B8E82; margin: 0 auto 18px; max-width: 38ch; line-height: 1.5; }
.tap-btn { display: block; padding: 14px 16px; margin-top: 10px; background: #16382A; color: #F1EFE6; font-family: ui-monospace, Menlo, monospace; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; text-decoration: none; text-align: center; border-radius: 3px; white-space: nowrap; }
.tap-btn:first-of-type { margin-top: 0; }
.tap-btn .arr { margin-left: 6px; }
.tap-fine { text-align: center; font-size: 11px; color: #9BABA0; margin: 14px 0 0; font-family: ui-monospace, Menlo, monospace; letter-spacing: 0.06em; }

/* QR card — secondary/fallback path, positioned below one-tap. */
.qr-card { margin-top: 18px; background: #F1EFE6; padding: 26px 24px 28px; border-radius: 6px; border: 1px solid #D9D6C6; text-align: center; }
.qr-card .tap-eyebrow { margin-bottom: 18px; }
.qr-box { display: inline-block; width: 160px; height: 160px; background: #FBFAF5; padding: 10px; box-sizing: border-box; border: 1px solid #D9D6C6; }
.qr-box img { width: 140px; height: 140px; display: block; }
.qr-p { margin: 14px auto 0; max-width: 36ch; font-size: 14px; color: #375948; line-height: 1.55; }
.meta-tbl { width: 100%; border-collapse: separate; border-spacing: 1px; background: #D9D6C6; margin-top: 32px; border: 1px solid #D9D6C6; }
.meta-tbl td { background: #FBFAF5; padding: 14px 12px; vertical-align: top; width: 25%; }
.meta-tbl small { font-family: ui-monospace, Menlo, monospace; font-size: 9px; letter-spacing: 0.2em; text-transform: uppercase; color: #7B8E82; display: block; margin-bottom: 4px; }
.meta-tbl b { font-family: 'Instrument Serif', Georgia, serif; font-style: italic; font-weight: 400; font-size: 22px; color: #16382A; letter-spacing: -0.01em; }
.footer { text-align: center; padding: 20px 24px; font-family: ui-monospace, Menlo, monospace; font-size: 10px; letter-spacing: 0.2em; color: #7B8E82; text-transform: uppercase; }
.footer a { color: #7B8E82; text-decoration: none; }
</style>
</head>
<body>
<div class="wrap">
  <div class="card">
    <div class="stamp">
      <div class="crest">N</div>
      <div class="denom">Nimvoy · {{ stamp_iso3 }}<br>{{ stamp_year }}</div>
    </div>

    <div class="inner">
      <div class="eyebrow">A postcard from Nimvoy — order {{ reference }}</div>

      <h1>{{ country_name }} is calling.<br><span style="font-style:normal;color:#C4633A">You'll answer.</span></h1>

      <p class="letter">
        Your eSIM for {{ country_name }} is on its way — well, <em>it's already here.</em>
        Below is a little square of pixels that holds {{ data_display }} of {{ speed_label }} data,
        {{ validity_days }}&nbsp;day{{ "" if validity_days == 1 else "s" }} of roaming across {{ networks }}, and a quiet
        promise: the moment you land, you're online. Maps, messages, a video home. No more airport
        Wi-Fi dances.
      </p>
      <p class="letter" style="margin-top:14px">
        Scan it while you're still on home Wi-Fi. It's a 60-second thing.
      </p>
      <div class="signature">— Nimvoy</div>

      {% if apple_install_url or android_install_url %}
      <div class="tap-section">
        <p class="tap-eyebrow">Tap to install</p>
        <h4 class="tap-h4">One-tap install</h4>
        <p class="tap-sub">Reading this on the phone you'll use? Tap below — your system pops the eSIM setup straight away.</p>
        {# Color is also set inline + wrapped in <span> because Gmail web
           overrides <a> color from CSS classes; inline + nested span is the
           bulletproof pattern for forcing a link text color in email. #}
        {% if apple_install_url %}
        <a class="tap-btn" href="{{ apple_install_url }}" style="color:#F1EFE6;text-decoration:none"><span style="color:#F1EFE6">Install on iPhone <span class="arr">→</span></span></a>
        {% endif %}
        {% if android_install_url %}
        <a class="tap-btn" href="{{ android_install_url }}" style="color:#F1EFE6;text-decoration:none"><span style="color:#F1EFE6">Install on Android <span class="arr">→</span></span></a>
        {% endif %}
        <p class="tap-fine">Works on iOS 17.4+ and Android 10+</p>
      </div>
      {% endif %}

      <div class="qr-card">
        <p class="tap-eyebrow">One-tap didn't work? Scan instead</p>
        <div class="qr-box">
          <img src="cid:qrcode" alt="eSIM activation QR" />
        </div>
        <p class="qr-p">Open your camera. Point it here. Tap the prompt. Your phone does the rest — no account, no app.</p>
      </div>

      <table class="meta-tbl" role="presentation" cellpadding="0" cellspacing="0">
        <tr>
          <td><small>Data</small><b>{{ data_display }}</b></td>
          <td><small>Days</small><b>{{ validity_days }}</b></td>
          <td><small>Speed</small><b>{{ speed_label }}</b></td>
          <td><small>Paid</small><b>${{ amount_display }}</b></td>
        </tr>
      </table>
    </div>
  </div>

  <div class="footer">
    <a href="https://www.nimvoy.com/order/{{ reference }}">View in browser</a> ·
    <a href="mailto:support@nimvoy.com">support@nimvoy.com</a><br><br>
    Nimvoy · Global eSIM
  </div>
</div>
</body>
</html>
""")


def _format_data_amount(data_gb: int) -> str:
    """Render the data allowance for display ("Unlimited" instead of 999GB)."""
    return "Unlimited" if data_gb >= 999 else f"{data_gb} GB"


# Country metadata used by the postcard email template. Keys match the
# `country` column on Plan rows (ISO-2 for single-country plans, bespoke
# codes for regional bundles). Expand as the catalog grows.
#
# Each entry: name, ISO-3 (postcard stamp caption), capital/largest city
# (postmark caption), local network names (woven into the letter body).
_COUNTRY_META = {
    "US":  {"name": "USA",                "iso3": "USA",  "city": "New York", "networks": "T-Mobile and AT&T"},
    "JP":  {"name": "Japan",              "iso3": "JPN",  "city": "Tokyo",    "networks": "Docomo and SoftBank"},
    "KR":  {"name": "Korea",              "iso3": "KOR",  "city": "Seoul",    "networks": "SK Telecom and KT"},
    "CN":  {"name": "China",              "iso3": "CHN",  "city": "Beijing",  "networks": "China Mobile and Unicom"},
    "EU":  {"name": "Europe",             "iso3": "EUR",  "city": "Madrid",   "networks": "Orange, Vodafone, and local partners"},
    "AP":  {"name": "Asia-Pacific",       "iso3": "APAC", "city": "Singapore","networks": "Singtel, AIS, and regional partners"},
    "CHM": {"name": "China + HK + Macau", "iso3": "CHN",  "city": "Hong Kong","networks": "China Mobile, CSL, and CTM"},
}


def _country_meta(country_code: str) -> dict:
    """Look up metadata for a country code, falling back to safe defaults."""
    code = (country_code or "").upper()
    return _COUNTRY_META.get(
        code,
        {"name": code or "your destination", "iso3": code[:3] or "INT", "city": "There", "networks": "local partners"},
    )


def _country_label(country_code: str) -> str:
    """Friendly country label (kept for callers that still use this name)."""
    return _country_meta(country_code)["name"]


def generate_qr_image(data: str) -> bytes:
    """Generate a QR code PNG image from data string.

    Args:
        data: The activation code / URL to encode in the QR code

    Returns:
        PNG image bytes
    """
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")

    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    return buffer.getvalue()


ORDER_FAILED_TEMPLATE = Template("""
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #0B1F3A; }
        .header { text-align: center; padding: 20px 0; }
        .header h1 { color: #0B1F3A; margin: 0; font-size: 24px; }
        .icon { text-align: center; font-size: 48px; margin: 20px 0; }
        .details { background: #F6F4EE; border: 1px solid #E2DED2; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .details h3 { margin-top: 0; color: #0B1F3A; }
        .details p { margin: 8px 0; }
        .refund-box { background: #E8F3EC; border-radius: 8px; padding: 16px; margin: 20px 0; }
        .refund-box p { color: #2F7A5B; font-weight: 500; margin: 0; }
        .footer { text-align: center; color: #6B7A8E; font-size: 12px; padding: 20px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>We couldn't complete your order</h1>
    </div>

    <p>Hi — we're sorry, something went wrong while preparing your eSIM and we weren't able to deliver it. Your money hasn't been kept.</p>

    <div class="details">
        <h3>Order Details</h3>
        <p><strong>Order Reference:</strong> {{ reference }}</p>
        <p><strong>Plan:</strong> {{ plan_name }}</p>
        <p><strong>Amount:</strong> ${{ amount }}</p>
    </div>

    <div class="refund-box">
        <p>✓ We've refunded ${{ amount }} to your card. It typically appears on your statement in 5–10 business days.</p>
    </div>

    <p>If you don't see the refund within 10 business days, just reply to this email and we'll track it down for you.</p>

    <div class="footer">
        <p>Order Reference: {{ reference }}</p>
        <p>Nimvoy — Global eSIM</p>
    </div>
</body>
</html>
""")


def send_order_failed_email(
    to_email: str,
    reference: str,
    plan_name: str,
    amount_cents: int,
) -> bool:
    """Notify the customer that fulfillment failed and we've refunded them."""
    try:
        amount_str = f"{amount_cents / 100:.2f}"
        html_body = ORDER_FAILED_TEMPLATE.render(
            reference=reference,
            plan_name=plan_name,
            amount=amount_str,
        )

        ses_client = boto3.client(
            "ses",
            region_name=settings.aws_region,
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
        )
        ses_client.send_email(
            Source=settings.aws_ses_from_email,
            Destination={"ToAddresses": [to_email]},
            Message={
                "Subject": {"Data": f"Your order couldn't be completed — refunded — {reference}"},
                "Body": {"Html": {"Data": html_body}},
            },
        )

        logger.info(f"Order-failed email sent to {to_email} for {reference}")
        return True

    except Exception as e:
        logger.error(f"Failed to send order-failed email to {to_email}: {e}")
        return False


def send_esim_email(
    to_email: str,
    reference: str,
    plan_name: str,
    data_gb: int,
    validity_days: int,
    country: str,
    qr_code_data: str,
    amount_cents: int = 0,
) -> bool:
    """Send the eSIM QR code email to the customer.

    Args:
        to_email: Customer's email address
        reference: Order reference (e.g., ESIM-A3X9K2)
        plan_name: Display name of the plan
        data_gb: Data allowance in GB
        validity_days: Plan validity in days
        country: Destination country name
        qr_code_data: Raw data to encode in the QR code

    Returns:
        True if email sent successfully, False otherwise
    """
    try:
        from datetime import datetime as _dt

        # Generate QR code image
        qr_image_bytes = generate_qr_image(qr_code_data)

        meta = _country_meta(country)
        country_name = meta["name"]
        now = _dt.now()

        # Build email
        msg = MIMEMultipart("related")
        msg["Subject"] = f"{country_name} is calling — your Nimvoy eSIM is ready ✦ {reference}"
        msg["From"] = f"Nimvoy <{settings.aws_ses_from_email}>"
        msg["To"] = to_email

        # One-tap install links for iOS and Android. Both require an LPA-
        # prefixed activation string (iOS 17.4+ / Android 10+). Skip if
        # qr_code_data isn't an LPA string — JoyTel sometimes returns a
        # hosted image URL instead, which neither OS can consume directly.
        is_lpa = qr_code_data.startswith("LPA:")
        apple_install_url = _apple_install_url(qr_code_data) if is_lpa else None
        android_install_url = _android_install_url(qr_code_data) if is_lpa else None

        # Render HTML body using the postcard template.
        html_body = EMAIL_TEMPLATE.render(
            reference=reference,
            plan_name=plan_name,
            data_display=_format_data_amount(data_gb),
            validity_days=validity_days,
            country_name=country_name,
            networks=meta["networks"],
            speed_label="5G",  # JoyTel doesn't surface per-plan speed; default
            stamp_iso3=meta["iso3"],
            stamp_year=now.year,
            amount_display=f"{amount_cents / 100:.2f}" if amount_cents else "—",
            apple_install_url=apple_install_url,
            android_install_url=android_install_url,
        )
        msg.attach(MIMEText(html_body, "html"))

        # Attach QR code image (inline)
        qr_attachment = MIMEImage(qr_image_bytes, _subtype="png")
        qr_attachment.add_header("Content-ID", "<qrcode>")
        qr_attachment.add_header("Content-Disposition", "inline", filename="esim-qr.png")
        msg.attach(qr_attachment)

        # Send via SES
        ses_client = boto3.client(
            "ses",
            region_name=settings.aws_region,
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
        )
        ses_client.send_raw_email(
            Source=settings.aws_ses_from_email,
            Destinations=[to_email],
            RawMessage={"Data": msg.as_string()},
        )

        logger.info(f"eSIM email sent to {to_email} for order {reference}")
        return True

    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")
        return False
