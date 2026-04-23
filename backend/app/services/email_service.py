"""Email delivery via AWS SES — payment confirmation and QR code delivery."""

import base64
import io
import logging
from email.mime.image import MIMEImage
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import boto3
import qrcode
from jinja2 import Template

from app.config import settings

logger = logging.getLogger(__name__)


# --- Payment Confirmation Email ---

PAYMENT_CONFIRMATION_TEMPLATE = Template("""
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; }
        .header { text-align: center; padding: 20px 0; }
        .header h1 { color: #2563eb; margin: 0; }
        .icon { text-align: center; font-size: 48px; margin: 20px 0; }
        .details { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .details h3 { margin-top: 0; color: #1e40af; }
        .details p { margin: 8px 0; }
        .status-box { background: #fef3c7; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center; }
        .status-box p { color: #92400e; font-weight: 600; margin: 0; }
        .footer { text-align: center; color: #94a3b8; font-size: 12px; padding: 20px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Payment Confirmed ✓</h1>
    </div>

    <div class="icon">💳</div>

    <p>Hi there! We've received your payment. Your eSIM is now being prepared.</p>

    <div class="details">
        <h3>Order Details</h3>
        <p><strong>Order Reference:</strong> {{ reference }}</p>
        <p><strong>Plan:</strong> {{ plan_name }}</p>
        <p><strong>Amount:</strong> ${{ amount }}</p>
        <p><strong>Email:</strong> {{ email }}</p>
    </div>

    <div class="status-box">
        <p>⏳ Your eSIM QR code is being generated. You'll receive a second email shortly with your QR code and setup instructions.</p>
    </div>

    <div class="footer">
        <p>Order Reference: {{ reference }}</p>
        <p>If you have any issues, reply to this email.</p>
    </div>
</body>
</html>
""")


def send_payment_confirmation_email(
    to_email: str,
    reference: str,
    plan_name: str,
    amount_cents: int,
) -> bool:
    """Send a payment confirmation email immediately after Stripe payment.

    This gives the customer immediate reassurance while we process
    the JoyTel order and QR code generation.
    """
    try:
        amount_str = f"{amount_cents / 100:.2f}"
        html_body = PAYMENT_CONFIRMATION_TEMPLATE.render(
            reference=reference,
            plan_name=plan_name,
            amount=amount_str,
            email=to_email,
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
                "Subject": {"Data": f"Payment Confirmed — {reference}"},
                "Body": {"Html": {"Data": html_body}},
            },
        )

        logger.info(f"Payment confirmation email sent to {to_email} for {reference}")
        return True

    except Exception as e:
        logger.error(f"Failed to send payment confirmation to {to_email}: {e}")
        return False

# HTML email template for QR code delivery
EMAIL_TEMPLATE = Template("""
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; }
        .header { text-align: center; padding: 20px 0; }
        .header h1 { color: #2563eb; margin: 0; }
        .qr-container { text-align: center; padding: 30px; background: #f8fafc; border-radius: 12px; margin: 20px 0; }
        .qr-container img { width: 250px; height: 250px; }
        .details { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .details h3 { margin-top: 0; color: #1e40af; }
        .details p { margin: 8px 0; }
        .steps { background: #eff6ff; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .steps h3 { margin-top: 0; color: #1e40af; }
        .steps ol { padding-left: 20px; }
        .steps li { margin: 8px 0; }
        .footer { text-align: center; color: #94a3b8; font-size: 12px; padding: 20px 0; }
        .ref { color: #64748b; font-size: 14px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Your eSIM is ready! 🌐</h1>
    </div>

    <div class="qr-container">
        <p style="font-weight: bold; margin-bottom: 15px;">Scan this QR code to install your eSIM:</p>
        <img src="cid:qrcode" alt="eSIM QR Code" />
    </div>

    <div class="details">
        <h3>Order Details</h3>
        <p><strong>Order Reference:</strong> {{ reference }}</p>
        <p><strong>Plan:</strong> {{ plan_name }}</p>
        <p><strong>Data:</strong> {{ data_gb }}GB</p>
        <p><strong>Validity:</strong> {{ validity_days }} days</p>
    </div>

    <div class="steps">
        <h3>Setup Instructions</h3>
        <ol>
            <li>Open <strong>Settings → Cellular → Add eSIM</strong> on your phone</li>
            <li>Choose <strong>"Use QR Code"</strong> and scan the code above</li>
            <li>Label it something helpful (e.g., "Travel {{ country }}")</li>
            <li>When asked, you can set it as your data line</li>
        </ol>
        <p>⚠️ <strong>Important:</strong> Don't activate until you arrive at your destination — your plan starts when you first connect to a network.</p>
    </div>

    <div class="footer">
        <p class="ref">Order Reference: {{ reference }}</p>
        <p>If you have any issues, reply to this email.</p>
    </div>
</body>
</html>
""")


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
        # Generate QR code image
        qr_image_bytes = generate_qr_image(qr_code_data)

        # Build email
        msg = MIMEMultipart("related")
        msg["Subject"] = f"Your eSIM is ready! 🌐 — {reference}"
        msg["From"] = settings.aws_ses_from_email
        msg["To"] = to_email

        # Render HTML body
        html_body = EMAIL_TEMPLATE.render(
            reference=reference,
            plan_name=plan_name,
            data_gb=data_gb,
            validity_days=validity_days,
            country=country,
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
