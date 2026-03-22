# JoyTel API Integration Review

## Overview
JoyTel uses **two separate systems** that we need to integrate with:

1. **Warehouse System** (JoyTel Shop) — order placement, order status, callbacks
2. **RSP+ System** — QR code retrieval, eSIM status, usage data

## Integration Flow

```
Customer buys plan → Our backend → Warehouse API (place order)
                                        ↓
                          JoyTel processes (≤30 sec)
                                        ↓
                     Callback to our server with snPin
                                        ↓
                     Our backend → RSP+ API (get QR code using snPin/coupon)
                                        ↓
                     QR code callback to our server
                                        ↓
                     Deliver QR code to customer (email + dashboard)
```

## Key Concepts

| Term | Meaning |
|------|---------|
| **snPin** | Same as "coupon" — the redemption code used to get QR code |
| **coupon** | Same as snPin — used in RSP+ system |
| **snCode** | Serial code of eSIM, format: `898620003xxxxxxx` |
| **CID** | Unique ID of eSIM profile |

## Authentication

### Warehouse API
- Credentials: `customerCode` + `customerAuth` (provided by JoyTel)
- IP whitelist required

### RSP+ API
- Credentials: `AppID` + `AppSecret` (provided by JoyTel)
- Base URL: `https://esim.joytelecom.com/openapi`
- IP whitelist required

## What We Need From JoyTel
- [ ] `customerCode` and `customerAuth` (Warehouse)
- [ ] `AppID` and `AppSecret` (RSP+)
- [ ] Our server IPs whitelisted
- [ ] Postman collection (they mention offline export available)
- [ ] Product/plan catalog (what plans are available to resell)

## What We Need to Build

### Backend Endpoints (our server)

1. **POST `/api/orders`** — Customer places order
   - Validate payment (Stripe)
   - Call JoyTel Warehouse API to submit order
   - Set `replyType = 1` for callback notification
   - Store order in our DB as "pending"

2. **POST `/api/webhooks/joytel/order`** — Receive order callback from JoyTel
   - Receive snPin from JoyTel
   - Store snPin in our DB
   - Must return HTTP 200 (otherwise JoyTel retries)
   - Use snPin to request QR code from RSP+

3. **POST `/api/webhooks/joytel/qrcode`** — Receive QR code callback
   - URL must end with `/notify/coupon/redeem`
   - Store QR code
   - Trigger email delivery to customer
   - Update order status to "completed"

4. **GET `/api/orders/:id/status`** — Customer checks order status
   - If callback was missed, call JoyTel's "Get Transaction Status" API as fallback

5. **GET `/api/esim/:id/usage`** — Check eSIM usage
   - Call RSP+ API for usage/status data

## Architecture Recommendation

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Frontend   │────▶│  Our Backend  │────▶│  JoyTel APIs    │
│  (Next.js)   │     │  (Next.js API │     │  - Warehouse    │
│              │◀────│   Routes)     │◀────│  - RSP+         │
└─────────────┘     └──────────────┘     └─────────────────┘
                           │
                    ┌──────┴──────┐
                    │  PostgreSQL  │
                    │  - orders    │
                    │  - esims     │
                    │  - users     │
                    └─────────────┘
```

## Concerns & Questions

1. **Order processing time** — Up to 30 seconds. We need a good UX for this wait (progress indicator, "preparing your eSIM..." screen, then redirect/email when ready)

2. **Callback reliability** — What if our server is down when JoyTel sends the callback? We need:
   - A polling fallback (Get Transaction Status API)
   - A background job that checks pending orders periodically

3. **Error handling** — What happens if an order fails? Refund flow via Stripe?

4. **Rate limits** — Not mentioned in the doc. Need to ask JoyTel.

5. **Sandbox/test environment** — Not mentioned. Need to ask if they have one.

6. **Product catalog API** — How do we get the list of available plans, prices, and countries? Is there an API for this or is it a static list?

## Action Items

1. **Ask JoyTel for:**
   - Test/sandbox credentials
   - Product catalog (plans, countries, pricing)
   - Rate limit info
   - Error code documentation
   - Full Postman collection

2. **Set up:**
   - Backend with webhook endpoints
   - Database schema for orders + eSIMs
   - Stripe integration for payments
   - Email service for QR delivery
