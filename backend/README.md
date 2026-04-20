# eSIM Backend

FastAPI backend for the eSIM reseller — handles checkout, JoyTel integration, and QR code delivery.

## Quick Start

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy and edit environment variables
cp .env.example .env
# Edit .env with your actual credentials

# Seed the database with initial plan
python -m app.seed

# Run the server
uvicorn app.main:app --reload --port 8000
```

## API Endpoints

### Public
- `GET /api/plans` — List available eSIM plans
- `POST /api/checkout` — Create a Stripe Checkout Session
- `GET /api/orders/{reference}/status` — Check order status

### Webhooks (called by external services)
- `POST /api/webhooks/stripe` — Stripe payment confirmation
- `POST /api/webhooks/joytel/order` — JoyTel order callback (delivers snPin)
- `POST /api/webhooks/joytel/notify/coupon/redeem` — JoyTel RSP+ QR code callback (redeem notification)

### Internal
- `GET /api/health` — Health check

## Purchase Flow

1. Frontend calls `POST /api/checkout` with `{plan_id, email}`
2. Backend creates order + Stripe Checkout Session, returns checkout URL
3. User pays on Stripe's hosted page
4. Stripe webhook confirms payment → backend submits order to JoyTel
5. JoyTel callback delivers snPin → backend requests QR from RSP+
6. RSP+ callback delivers QR code → backend emails customer

## Deployment

See `TECH-SPEC-M1.md` in the repo root for full deployment instructions.
