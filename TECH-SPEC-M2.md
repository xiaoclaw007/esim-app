# Tech Spec — Milestone 2: Customer Portal & Account System

**Status:** Draft — awaiting review
**Last updated:** 2026-03-29

---

## Goal

Customers can create an account (Google OAuth or email/password), log in, and view their order history and status. This lays the foundation for M3 (referral & affiliate system) by establishing user identity.

## User Stories (M2)

1. User signs up with Google or email/password
2. User logs in and sees their dashboard
3. User views order history with status for each order
4. User views order details (plan info, status timeline)
5. User manages their profile (name, email)
6. Returning user's checkout is pre-filled with their email
7. Each user gets a unique referral code on signup (M3 prep — not yet functional)

---

## Architecture Changes from M1

```
┌─────────────────┐       ┌──────────────────┐       ┌─────────────────┐
│   Frontend       │──────▶│   Python Backend  │──────▶│   JoyTel APIs   │
│  (EC2 / nginx)  │       │   (FastAPI)       │       │   (M1)          │
│                  │       │                   │       └─────────────────┘
│  + Login page    │       │  + Auth endpoints │
│  + Dashboard     │       │  + User model     │
│  + Order history │       │  + JWT auth       │
│  + Profile page  │       │  + PostgreSQL     │
└─────────────────┘       └──────────────────┘
                                │       ▲
                          ┌─────┘       └─────┐
                          ▼                   ▼
                   ┌────────────┐      ┌────────────┐
                   │   Stripe   │      │  SES/Email  │
                   └────────────┘      └────────────┘
                          │
                   ┌──────┴──────┐
                   │  PostgreSQL  │
                   │  (local)    │
                   └─────────────┘
```

### What's new in M2

| Component | Change |
|-----------|--------|
| Database | SQLite → PostgreSQL (user accounts + sessions need it) |
| Auth | New — Google OAuth + email/password via our own JWT system |
| Frontend | New pages: login, signup, dashboard, order history, profile |
| Backend | New auth middleware, user endpoints, protected routes |

---

## Authentication Design

### Strategy: Self-managed auth with JWT

We'll handle auth ourselves rather than using Firebase. Keeps us in control, avoids vendor lock-in, and FastAPI has excellent JWT/OAuth2 support.

- **Google OAuth 2.0** — "Sign in with Google" button, we handle the OAuth flow server-side
- **Email/password** — bcrypt-hashed passwords, email verification
- **JWT tokens** — short-lived access token (15 min) + long-lived refresh token (30 days)
- **HttpOnly cookies** for refresh token, Authorization header for access token

### Auth Flow: Google OAuth

```
1. User clicks "Sign in with Google"
         │
         ▼
2. Frontend redirects to Google's OAuth consent screen
   GET https://accounts.google.com/o/oauth2/v2/auth
   ?client_id=...&redirect_uri=.../api/auth/google/callback&scope=email+profile
         │
         ▼
3. User grants consent → Google redirects to our callback
   GET /api/auth/google/callback?code=...
         │
         ▼
4. Backend exchanges code for Google tokens
   → Fetches user profile (email, name, avatar)
   → Creates/finds user in DB
   → Issues our JWT access + refresh tokens
   → Redirects to frontend dashboard with tokens
```

### Auth Flow: Email/Password

```
1. User fills signup form (email, name, password)
   POST /api/auth/signup
         │
         ▼
2. Backend creates user (password hashed with bcrypt)
   → Returns JWT tokens
   → (Future: send verification email)
         │
         ▼
3. Login: POST /api/auth/login { email, password }
   → Validates credentials
   → Returns JWT tokens
```

---

## API Endpoints

### Auth (new)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/auth/signup` | No | Create account with email/password |
| POST | `/api/auth/login` | No | Login with email/password |
| POST | `/api/auth/refresh` | Refresh token | Get new access token |
| POST | `/api/auth/logout` | Yes | Invalidate refresh token |
| GET | `/api/auth/google` | No | Initiate Google OAuth flow |
| GET | `/api/auth/google/callback` | No | Google OAuth callback |

### User (new)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/users/me` | Yes | Get current user profile |
| PATCH | `/api/users/me` | Yes | Update profile (name) |

### Orders (updated)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/orders` | Yes | List user's orders (paginated) |
| GET | `/api/orders/{ref}` | Yes | Order detail (owner only) |
| GET | `/api/orders/{ref}/status` | No | Public status check (M1 compat — by ref only) |

### Checkout (updated)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/checkout` | Optional | Create checkout — links to user if logged in |

### Existing (unchanged)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/plans` | List plans |
| GET | `/api/health` | Health check |
| POST | `/api/webhooks/stripe` | Stripe webhook |
| POST | `/api/webhooks/joytel/order` | JoyTel order callback |
| POST | `/api/webhooks/joytel/qrcode` | JoyTel QR callback |

---

## Data Model Changes

### New: `users` table

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| email | VARCHAR(255) | Unique, required |
| name | VARCHAR(200) | Display name |
| password_hash | VARCHAR(255) | Nullable (Google-only users won't have one) |
| google_id | VARCHAR(255) | Nullable, unique — Google OAuth subject ID |
| avatar_url | VARCHAR(500) | From Google profile |
| referral_code | VARCHAR(10) | Unique, auto-generated on signup (M3 prep) |
| referred_by | VARCHAR(10) | Referral code of who invited them (M3 prep) |
| is_active | BOOLEAN | Default true |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### New: `refresh_tokens` table

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| user_id | UUID | FK → users |
| token_hash | VARCHAR(255) | Hashed refresh token |
| expires_at | TIMESTAMP | 30 days from creation |
| revoked | BOOLEAN | Default false |
| created_at | TIMESTAMP | |

### Updated: `orders` table

| Column | Change |
|--------|--------|
| user_id | **New** — UUID, FK → users, nullable (guest orders from M1 have no user) |

---

## Database Migration: SQLite → PostgreSQL

Since M1 is running SQLite and we don't have real customer data yet (JoyTel isn't integrated), this is a clean migration:

1. Install PostgreSQL on the EC2 instance (local, no RDS needed for now)
2. Create database and user
3. Run Alembic migrations to create all tables (including new user tables)
4. Seed the plans table
5. Update `.env` with `DATABASE_URL=postgresql://...`

If there were real orders to preserve, we'd export/import. But since we're still in test mode, a fresh DB is fine.

---

## Frontend Pages

### New Pages

| Page | URL | Auth Required | Description |
|------|-----|---------------|-------------|
| Login | `/login` | No | Email/password form + "Sign in with Google" button |
| Signup | `/signup` | No | Name, email, password form + Google option |
| Dashboard | `/dashboard` | Yes | Overview: recent orders, quick stats |
| Order History | `/dashboard/orders` | Yes | Paginated list of all orders |
| Order Detail | `/dashboard/orders/{ref}` | Yes | Full order info + status timeline |
| Profile | `/dashboard/profile` | Yes | Edit name, view email, see referral code |

### Updated Pages

| Page | Change |
|------|--------|
| Header/Nav | Add Login/Signup buttons (or user menu when logged in) |
| Plans page | Show "Sign in for order tracking" prompt |
| Checkout | Pre-fill email if logged in; link order to user account |
| Confirmation | Show "Create account to track this order" if guest |

### Frontend Auth Handling

- Store JWT access token in memory (JS variable, not localStorage — XSS safety)
- Refresh token in HttpOnly cookie (handled automatically by browser)
- On page load: try to refresh the access token silently
- Protected pages redirect to `/login` if not authenticated
- After login, redirect back to where they were going

---

## Backend Structure (new/changed files)

```
app/
├── routers/
│   ├── auth.py          # NEW — signup, login, Google OAuth, refresh, logout
│   ├── users.py         # NEW — profile endpoints
│   ├── plans.py         # unchanged
│   ├── checkout.py      # UPDATED — optional user linking
│   ├── orders.py        # UPDATED — user-scoped order list + detail
│   └── webhooks.py      # unchanged
├── services/
│   ├── auth_service.py  # NEW — JWT creation/validation, password hashing
│   ├── google_oauth.py  # NEW — Google OAuth flow
│   ├── stripe_service.py
│   ├── joytel_warehouse.py
│   ├── joytel_rsp.py
│   └── email_service.py
├── middleware/
│   └── auth.py          # NEW — JWT auth dependency for FastAPI
├── models.py            # UPDATED — User + RefreshToken models, Order.user_id
├── schemas.py           # UPDATED — auth request/response schemas
├── config.py            # UPDATED — new auth/Google settings
├── database.py          # UPDATED — PostgreSQL connection string
└── main.py              # UPDATED — include new routers
```

### Key Libraries (new)

- `python-jose[cryptography]` — JWT encoding/decoding
- `passlib[bcrypt]` — password hashing
- `authlib` or `httpx` — Google OAuth2 flow
- `psycopg2-binary` — PostgreSQL driver
- `asyncpg` — async PostgreSQL driver (if using async SQLAlchemy)

---

## Environment Variables (new)

```
# Auth
JWT_SECRET_KEY=<random-256-bit>
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=15
JWT_REFRESH_TOKEN_EXPIRE_DAYS=30

# Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://34.203.146.15/api/auth/google/callback

# Database (updated)
DATABASE_URL=postgresql://esim_user:password@localhost:5432/esim_db
```

---

## Referral Code (M3 Prep)

Every new user gets a unique 8-character referral code on signup (e.g., `REF-X7K9M2`). For M2, this is just stored and displayed on the profile page. The actual referral reward system comes in M3.

- Generated from a random alphanumeric string
- Checked for uniqueness before saving
- Displayed on profile: "Your referral code: REF-X7K9M2"
- Signup form has optional "Referral code" field → stored as `referred_by`

---

## Security Considerations

- Passwords hashed with bcrypt (cost factor 12)
- JWT access tokens are short-lived (15 min) to limit damage if leaked
- Refresh tokens are hashed in DB, can be revoked individually
- Google OAuth state parameter to prevent CSRF
- Rate limiting on login/signup endpoints (5 per minute per IP)
- Order list/detail endpoints verify ownership (user can only see their own orders)
- CORS restricted to our frontend origin

---

## Development Plan

### Phase 1: Database migration (Day 1)
- Install PostgreSQL on EC2
- Update SQLAlchemy config for PostgreSQL
- Add User + RefreshToken models
- Add user_id FK to orders
- Run Alembic migration
- Seed plans

### Phase 2: Auth backend (Days 2-3)
- Email/password signup + login endpoints
- JWT token creation + validation
- Refresh token flow
- Auth middleware (FastAPI dependency)
- Google OAuth flow
- Rate limiting on auth endpoints

### Phase 3: User endpoints + order linking (Day 4)
- Profile endpoints (GET/PATCH /users/me)
- Update checkout to link orders to logged-in user
- User-scoped order list + detail endpoints
- Referral code generation on signup

### Phase 4: Frontend — auth pages (Days 5-6)
- Login page with Google + email/password
- Signup page
- Auth state management (token storage, silent refresh)
- Protected route handling
- Header/nav updates (login button vs user menu)

### Phase 5: Frontend — dashboard (Days 7-8)
- Dashboard overview page
- Order history page (paginated table/cards)
- Order detail page with status timeline
- Profile page (edit name, view referral code)

### Phase 6: Integration + polish (Days 9-10)
- Update checkout flow for logged-in users
- "Create account" prompt on confirmation page for guests
- Test all flows end-to-end
- Mobile-responsive check on all new pages

---

## Future Features (Parked for Later)

These were considered for M2 but deferred to keep scope tight:

- **Guest-to-account linking** — auto-link past guest orders to a new account by matching email
- **Email notifications** — order status change alerts, eSIM expiring soon
- **Re-download QR code** — let users re-access their QR code from the dashboard
- **Email verification** — send confirmation email on signup (for email/password users)
- **Password reset** — forgot password flow via email
- **eSIM management view** — show active vs expired eSIMs, data usage (requires JoyTel usage API)

---

## Open Questions

1. **Google Cloud project** — Do you have a Google Cloud account for OAuth credentials? Or should I set one up?
2. **Frontend framework** — M1 is vanilla HTML/JS. For the dashboard, we might want something like Alpine.js or lightweight templating to manage auth state and page transitions. Thoughts on keeping it vanilla vs. adding a minimal framework?
3. **Domain** — Still needed for proper OAuth redirect URIs (Google may not accept a bare IP in production). This was already on the M1 blocklist.
