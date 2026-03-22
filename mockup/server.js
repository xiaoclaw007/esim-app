require('dotenv').config();
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const path = require('path');

const app = express();

// Webhook endpoint needs raw body — must come before express.json()
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;
    try {
        if (endpointSecret) {
            event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
        } else {
            // No webhook secret configured — parse directly (dev only)
            event = JSON.parse(req.body.toString());
            console.log('⚠️  No webhook secret configured — skipping signature verification');
        }
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle events
    switch (event.type) {
        case 'payment_intent.succeeded':
            const pi = event.data.object;
            console.log(`✅ Payment succeeded: ${pi.id} — $${(pi.amount / 100).toFixed(2)} ${pi.currency.toUpperCase()}`);
            console.log(`   Email: ${pi.metadata.email || 'N/A'}`);
            console.log(`   Plan: ${pi.metadata.plan || 'N/A'}`);
            // TODO: Trigger eSIM delivery email here
            break;
        case 'payment_intent.payment_failed':
            const failedPi = event.data.object;
            console.log(`❌ Payment failed: ${failedPi.id} — ${failedPi.last_payment_error?.message || 'Unknown error'}`);
            break;
        default:
            console.log(`ℹ️  Unhandled event: ${event.type}`);
    }

    res.json({ received: true });
});

// JSON parsing for other routes
app.use(express.json());

// Serve static files (index.html, plans.html, checkout.html)
app.use(express.static(path.join(__dirname)));

// API: Get publishable key (so frontend doesn't hardcode it)
app.get('/api/config', (req, res) => {
    res.json({
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    });
});

// API: Create PaymentIntent
app.post('/api/create-payment-intent', async (req, res) => {
    try {
        const { amount, email, planName } = req.body;

        // Validate
        if (!amount || amount < 50) {
            return res.status(400).json({ error: 'Invalid amount (minimum 50 cents)' });
        }

        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount), // in cents
            currency: 'usd',
            metadata: {
                email: email || '',
                plan: planName || '',
            },
            receipt_email: email || undefined,
        });

        res.json({
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
        });
    } catch (err) {
        console.error('Error creating PaymentIntent:', err.message);
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 8090;
app.listen(PORT, () => {
    console.log(`\n🚀 GlobalSIM server running at http://localhost:${PORT}`);
    console.log(`   Stripe mode: ${process.env.STRIPE_SECRET_KEY?.startsWith('sk_live') ? '🔴 LIVE' : '🟢 TEST'}`);
    console.log(`   Webhook secret: ${process.env.STRIPE_WEBHOOK_SECRET ? 'configured ✓' : 'not set (dev mode)'}\n`);
});
