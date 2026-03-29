# Production Checklist — Before Real Launch

Things to do before accepting real customers and real money. Currently we're running a dev setup on a single EC2 with test keys — that's fine for building, but not for launch.

---

## Infrastructure

- [ ] **Migrate PostgreSQL to RDS** — separate DB from app server. Automated backups, failover, no data loss if EC2 dies. (~$15-30/mo for db.t3.micro)
- [ ] **Domain name** — register a domain, point it to Elastic IP. Needed for SSL, professional emails, Google OAuth, and customer trust.
- [ ] **HTTPS (SSL/TLS)** — Let's Encrypt via certbot once we have a domain. No excuses — everything must be HTTPS.
- [ ] **Remove nginx basic auth** — replace dev password gate with proper app-level access once we're ready to go public.
- [ ] **Backup strategy** — automated daily DB backups (RDS handles this, or cron pg_dump if staying on EC2).
- [ ] **Monitoring & alerts** — CloudWatch alarms for CPU, disk, memory. Alert if the backend goes down.
- [ ] **Logging** — centralized logging (CloudWatch Logs or similar). Currently just stdout/journald.
- [ ] **Auto-restart on crash** — systemd already handles this, but verify `Restart=always` is set.
- [ ] **Consider a larger instance** — t3.micro (1GB RAM) might be tight with PostgreSQL + FastAPI + nginx. t3.small (2GB) is safer for production.

## Security

- [ ] **Stripe live keys** — switch from test mode to live mode. New webhook secret needed.
- [ ] **Rotate all secrets** — JWT secret, DB password, API keys. Don't launch with the same ones used during dev.
- [ ] **SSH access** — restrict security group port 22 to specific IPs only (currently open).
- [ ] **Environment variables** — audit `.env` on EC2. No test keys, no placeholder values.
- [ ] **Rate limiting** — add rate limits on auth endpoints (login, signup) and checkout to prevent abuse.
- [ ] **CORS lockdown** — restrict to our actual domain only (currently may allow broad origins).
- [ ] **Webhook signature verification** — verify Stripe and JoyTel webhook signatures (Stripe is likely done, confirm JoyTel).
- [ ] **Disable debug mode** — ensure FastAPI is not running with `--reload` or debug flags in production.

## Payments & Compliance

- [ ] **Stripe live onboarding** — complete Stripe account verification for live payments.
- [ ] **Terms of Service** — legal page on the website. Required for Stripe.
- [ ] **Privacy Policy** — required by law (GDPR, CCPA) and by Google OAuth.
- [ ] **Refund policy** — define and display it. Stripe requires this.
- [ ] **Tax handling** — research if we need to collect sales tax / VAT. Stripe Tax can help.

## Email

- [ ] **SES production access** — request move out of sandbox (currently can only email verified addresses). Takes ~24h AWS approval.
- [ ] **Verify sending domain** — set up SPF/DKIM/DMARC records so emails don't land in spam.
- [ ] **Professional sender** — send from `noreply@ourdomain.com` instead of a personal Gmail.
- [ ] **Email templates** — review all transactional emails for professionalism and accuracy.

## JoyTel

- [ ] **Production credentials** — configure real customerCode, customerAuth, AppID, AppSecret.
- [ ] **IP whitelist** — confirm 34.203.146.15 (or new IP) is whitelisted with JoyTel.
- [ ] **Product catalog sync** — import all available plans/SKUs from JoyTel, not just the one test plan.
- [ ] **Error handling** — test all JoyTel failure scenarios (order rejected, timeout, invalid SKU, insufficient balance).
- [ ] **JoyTel balance monitoring** — alert when our prepaid balance is running low.

## Auth (M2)

- [ ] **Google OAuth production credentials** — move from test/dev to verified Google Cloud project. Requires app verification if >100 users.
- [ ] **Google OAuth consent screen** — fill in app name, logo, privacy policy URL, etc.
- [ ] **Email verification** — consider requiring email verification for email/password signups before they can purchase.

## Performance & Reliability

- [ ] **Load testing** — basic stress test to see how many concurrent users the single EC2 handles.
- [ ] **Database indexing** — add indexes on frequently queried columns (orders.user_id, orders.email, orders.reference, users.email, users.google_id).
- [ ] **Connection pooling** — configure SQLAlchemy connection pool appropriately for PostgreSQL.
- [ ] **CDN for static assets** — CloudFront or similar for frontend files (images, CSS, JS). Not critical early on but helps with global performance.

## Operations

- [ ] **Deployment process** — currently manual SSH + git pull. Set up CI/CD (GitHub Actions → deploy on push to main).
- [ ] **Rollback plan** — know how to revert a bad deploy quickly.
- [ ] **On-call process** — who gets paged if the site goes down? Set up basic uptime monitoring (UptimeRobot, free tier).
- [ ] **Customer support channel** — support email or contact form on the website.
- [ ] **Analytics** — basic page view / conversion tracking (Google Analytics, Plausible, or similar).

---

*Last updated: 2026-03-29*
*Review this checklist before every milestone that touches production.*
