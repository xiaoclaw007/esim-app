# Tech Spec — Milestone 1: End-to-End eSIM Purchase Flow

**Status:** Draft — awaiting review
**Last updated:** 2026-03-28

---

## Goal

A user can browse eSIM plans, pay via Stripe, and receive their eSIM QR code by email. No user accounts, no dashboard — just a clean purchase-to-delivery pipeline.

## User Stories (M1)

1. User browses the website and finds a plan for their destination
2. User enters email + payment info to checkout
3. On successful payment, user receives an email with eSIM details (QR code + instructions)

---

## Architecture Overview

```
┌─────────────────┐       ┌──────────────────┐       ┌─────────────────┐
│   Static Site   │──────▶│   Python Backend  │──────▶│   JoyTel APIs   │
│  (GitHub Pages) │       │   (AWS)           │◀──────│   (Warehouse +  │
│                 │       │                   │       │    RSP+)        │
└─────────────────┘       └──────────────────┘       └─────────────────┘
                                │       ▲
                          ┌─────┘       └─────┐
                          ▼                   ▼
                   ┌────────────┐      ┌────────────┐
                   │   Stripe   │      │  SES/Email  │
                   └────────────┘      └────────────┘
                          │
                   ┌──────┴──────┐
                   │  PostgreSQL  │
                   │   (RDS)     │
                   └─────────────┘
```

### Components

| Component | Tech | Hosting |
|-----------|------|---------|
| Frontend | Static HTML/CSS/JS (current site) | GitHub Pages (keep as-is for now) |
| Backend API | Python (FastAPI) | AWS — EC2 or ECS (see Hosting section) |
| Database | PostgreSQL | AWS RDS (or SQLite for MVP, see below) |
| Payments | Stripe Checkout (hosted) | Stripe-managed |
| Email | AWS SES | AWS |
| Task queue | None for M1 (synchronous + webhooks) | — |

---

## Hosting Decision Needed

Two options for the Python backend on AWS:

### Option A: Single EC2 instance (simple)
- One `t3.micro` or `t3.small` running the FastAPI app behind nginx
- Cheapest, simplest to debug, easy to SSH into
- SQLite is viable here (no need for RDS in M1)
- Static IP via Elastic IP → give to JoyTel for whitelist
- **Cost:** ~$8-15/mo

### Option B: ECS Fargate + RDS (scalable)
- Containerized, auto-scaling, no server management
- Requires RDS for database (containers are ephemeral)
- NAT Gateway or Elastic IP for stable outbound IP → JoyTel whitelist
- **Cost:** ~$30-50/mo minimum

**Recommendation:** Option A for M1. We're optimizing for speed to launch, not scale. We can migrate to ECS later if needed. EC2 also gives us a fixed IP for JoyTel's whitelist immediately.

---

## Purchase Flow (Detailed)

```
1. User selects a plan on the website
         │
         ▼
2. Frontend calls POST /api/checkout
   Body: { plan_id, email }
         │
         ▼
3. Backend creates a Stripe Checkout Session
   - Sets success_url and cancel_url
   - Stores pending order in DB (status: "created")
   - Returns Stripe Checkout URL
         │
         ▼
4. User redirected to Stripe Checkout (hosted by Stripe)
   - Enters card details, pays
         │
         ▼
5. Stripe sends webhook → POST /api/webhooks/stripe
   - Event: checkout.session.completed
   - Backend updates order status → "paid"
   - Backend calls JoyTel Warehouse API to place order
   - Order status → "joytel_pending"
         │
         ▼
6. JoyTel processes order (~30s)
   - Sends callback → POST /api/webhooks/joytel/order
   - Payload includes snPin (redemption code)
   - Backend stores snPin, status → "snpin_received"
   - Backend calls RSP+ API to redeem snPin → get QR code
         │
         ▼
7. RSP+ sends callback → POST /api/webhooks/joytel/qrcode
   - Payload includes QR code data (or we poll for it)
   - Backend stores QR code, status → "completed"
   - Backend sends email to user via SES
         │
         ▼
8. User receives email with:
   - QR code image
   - Setup instructions
   - Order reference number
```

### Failure Handling

| Failure Point | Action |
|---------------|--------|
| Stripe payment fails | Stripe handles this — user sees error on checkout page |
| JoyTel order callback never arrives | Background poller checks pending orders via JoyTel "Get Transaction Status" API every 60s |
| QR code callback never arrives | Poller retries RSP+ redemption after timeout (5 min) |
| Email delivery fails | Log error, retry via SES; user can also hit GET /api/orders/{ref}/status for manual retrieval |
| JoyTel order rejected | Refund via Stripe API, email user about failure |

---

## API Endpoints

### Public (called by frontend)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/plans` | List available eSIM plans (from our DB/config) |
| POST | `/api/checkout` | Create Stripe Checkout Session |
| GET | `/api/orders/{ref}/status` | Check order status (by order reference) |

### Webhooks (called by external services)

Webhooks are URLs on *our* server that external services call to notify us when something happens. We don't call these — they call us.

| Method | Path | Called by |
|--------|------|----------|
| POST | `/api/webhooks/stripe` | Stripe (payment confirmation) |
| POST | `/api/webhooks/joytel/order` | JoyTel Warehouse (order callback with snPin) |
| POST | `/api/webhooks/joytel/qrcode` | JoyTel RSP+ (QR code delivery) |

**`/api/webhooks/stripe`** — Stripe calls this when a customer successfully pays. Instead of trusting the frontend to tell us "payment succeeded" (which could be faked), Stripe sends a server-to-server notification. This is how we confirm the money actually landed before fulfilling the order.

**`/api/webhooks/joytel/order`** — After we submit an order to JoyTel's Warehouse API, they process it (~30 seconds) and then call this URL with the `snPin` (the redemption code needed to get the QR code). We store the snPin and use it to request the QR code from RSP+.

**`/api/webhooks/joytel/qrcode`** — After we use the `snPin` to request the QR code from JoyTel's RSP+ system, they call this URL to deliver the actual QR code data. Once we receive this, we have everything needed to email the customer their eSIM.

### Internal

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Health check |

---

## Data Model

### `orders` table

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| reference | VARCHAR(12) | Human-readable ref (e.g., `ESIM-A3X9K2`) |
| email | VARCHAR | Customer email |
| plan_id | VARCHAR | Which plan they bought |
| stripe_session_id | VARCHAR | Stripe Checkout Session ID |
| stripe_payment_intent | VARCHAR | For refunds |
| amount_cents | INTEGER | Price charged |
| currency | VARCHAR(3) | e.g., `usd` |
| status | VARCHAR | See status enum below |
| joytel_order_id | VARCHAR | JoyTel's order ID |
| sn_pin | VARCHAR | Redemption code from JoyTel |
| qr_code_data | TEXT | QR code payload (base64 or URL) |
| qr_code_url | VARCHAR | Stored QR code image URL (S3) |
| error_message | TEXT | If something failed |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### Order Status Enum

```
created → paid → joytel_pending → snpin_received → completed
                                                  → failed
```

### `plans` table (or static config file for M1)

| Column | Type | Notes |
|--------|------|-------|
| id | VARCHAR | Our plan ID |
| joytel_sku | VARCHAR | JoyTel product code |
| name | VARCHAR | Display name (e.g., "Japan 5GB / 30 days") |
| country | VARCHAR | ISO country code |
| region | VARCHAR | e.g., "asia", "europe" |
| data_gb | DECIMAL | Data allowance |
| validity_days | INTEGER | Plan duration |
| price_cents | INTEGER | Our selling price |
| currency | VARCHAR(3) | |
| active | BOOLEAN | Whether to show on site |

---

## Tech Stack Details

### Backend: FastAPI (Python)

```
project-esim-backend/
├── app/
│   ├── main.py              # FastAPI app, CORS, middleware
│   ├── config.py            # Env vars, settings
│   ├── models.py            # SQLAlchemy models
│   ├── schemas.py           # Pydantic request/response schemas
│   ├── database.py          # DB connection
│   ├── routers/
│   │   ├── plans.py         # GET /api/plans
│   │   ├── checkout.py      # POST /api/checkout
│   │   ├── orders.py        # GET /api/orders/{ref}/status
│   │   └── webhooks.py      # All webhook handlers
│   ├── services/
│   │   ├── stripe_service.py
│   │   ├── joytel_warehouse.py
│   │   ├── joytel_rsp.py
│   │   └── email_service.py
│   └── tasks/
│       └── order_poller.py  # Background task to check stale orders
├── alembic/                 # DB migrations
├── tests/
├── requirements.txt
├── Dockerfile
└── .env.example
```

### Key Libraries

- `fastapi` + `uvicorn` — web framework
- `sqlalchemy` + `alembic` — ORM + migrations
- `httpx` — async HTTP client for JoyTel API calls
- `stripe` — Stripe Python SDK
- `boto3` — AWS SES for email
- `pydantic-settings` — config management
- `qrcode` + `Pillow` — QR code image generation (if JoyTel returns raw data instead of image)

### Frontend Changes (Minimal for M1)

The current GitHub Pages site needs small updates:

1. **Plan listing** — fetch from `GET /api/plans` and render cards (or hardcode initially)
2. **Checkout button** — calls `POST /api/checkout`, redirects to Stripe
3. **Success page** — shown after Stripe redirects back; says "Check your email for your eSIM"
4. **CORS** — backend must allow the GitHub Pages origin

---

## Email Template

Subject: `Your eSIM is ready! 🌐`

Contents:
- Order reference number
- Plan details (destination, data, validity)
- QR code image (inline + attached)
- Setup instructions:
  1. Go to Settings → Cellular → Add eSIM
  2. Scan the QR code
  3. Label it (e.g., "Travel Japan")
  4. Enable when you arrive at destination
- Support contact
- Note: "Don't activate until you arrive — your plan starts when you first connect"

---

## Environment Variables

```
# App
APP_ENV=production
APP_SECRET_KEY=<random>
BACKEND_URL=https://api.example.com
FRONTEND_URL=https://example.github.io/esim-app

# Database
DATABASE_URL=sqlite:///./esim.db  # or postgresql://...

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# JoyTel Warehouse
JOYTEL_WAREHOUSE_URL=https://...
JOYTEL_CUSTOMER_CODE=...
JOYTEL_CUSTOMER_AUTH=...

# JoyTel RSP+
JOYTEL_RSP_URL=https://esim.joytelecom.com/openapi
JOYTEL_APP_ID=...
JOYTEL_APP_SECRET=...

# AWS
AWS_REGION=us-east-1
AWS_SES_FROM_EMAIL=noreply@example.com
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

---

## Infrastructure Setup (AWS)

### What we need:

1. **EC2 instance** (t3.micro/small)
   - Ubuntu 22.04 or Amazon Linux 2023
   - Elastic IP (for JoyTel whitelist)
   - Security group: inbound 80, 443, 22 (your IP only)
   - nginx as reverse proxy → uvicorn on port 8000

2. **Domain + SSL**
   - Point an API subdomain to the Elastic IP (e.g., `api.globalsim.com` or whatever domain)
   - Let's Encrypt via certbot for SSL
   - Or use Route 53 + ACM if staying full-AWS

3. **SES**
   - Verify sending domain
   - Request production access (out of sandbox) — takes ~24h approval
   - Create email template for QR delivery

4. **S3 bucket** (optional for M1)
   - Store QR code images if we want permanent URLs
   - Otherwise, generate and inline in email

### What I need from you:

- [ ] AWS account access or IAM credentials with permissions for EC2, SES, (optionally S3, RDS)
- [ ] Domain name for the API (or a subdomain of your existing domain)
- [ ] JoyTel credentials (customerCode, customerAuth, AppID, AppSecret)
- [ ] JoyTel product catalog (available plans/SKUs for us to resell)
- [ ] Stripe account (test keys to start, live keys for launch)

---

## Development Plan

### Phase 1: Backend scaffold + Stripe (Days 1-2)
- FastAPI project setup
- Database models + migrations
- `POST /api/checkout` → Stripe Checkout Session
- `POST /api/webhooks/stripe` → payment confirmation
- Test with Stripe test mode end-to-end

### Phase 2: JoyTel integration (Days 3-4)
- Warehouse API client (place order)
- RSP+ API client (redeem snPin → QR code)
- Webhook handlers for both callbacks
- Order status polling fallback

### Phase 3: Email delivery (Day 5)
- SES setup + domain verification
- Email template with QR code
- Trigger email on order completion

### Phase 4: Frontend wiring + deploy (Days 6-7)
- Update frontend to call backend APIs
- Deploy backend to EC2
- SSL + domain setup
- Give JoyTel the Elastic IP for whitelist
- End-to-end test with real JoyTel credentials

### Phase 5: Testing + hardening (Days 8-9)
- Error scenarios (payment fails, JoyTel timeout, callback miss)
- Retry logic
- Logging + basic monitoring (CloudWatch)
- Test with real purchase

---

## Out of Scope for M1

- User accounts / login
- Order history dashboard
- Usage monitoring
- Refund self-service
- Multi-currency
- Mobile app
- Regional/global bundle plans
- Analytics

---

## Open Questions

1. **JoyTel product catalog** — Do we have the list of available SKUs + pricing? We need this to populate the plans table/config.
2. **Margin/pricing** — What markup over JoyTel's wholesale price? This determines our selling prices.
3. **Domain** — What domain/subdomain for the API? (Needed for SSL, CORS, JoyTel callback URLs, SES)
4. **SES sending domain** — Same domain as the site, or a separate one?
5. **Stripe account** — Existing account or need to create one?
6. **JoyTel sandbox** — Do they offer a test environment, or do we test against production with small orders?
