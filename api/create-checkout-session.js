// api/create-checkout-session.js
//
// Handles Stripe Checkout fallback flow from bloom.html.
// Returns a URL for the user to complete the payment in Stripe Checkout.

const { stripe, supabase, parseBody, json } = require('./_stripeShared');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  try {
    const {
      amount,
      currency,
      recipientHandle,
      note,
      success_url,
      cancel_url
    } = parseBody(req);

    // Clamp the amount for safety
    const rawCents = Number.isFinite(amount) ? Math.round(amount) : 0;
    const cents = Math.max(100, Math.min(rawCents, 50000)); // $1–$500
    const cur = (currency || 'usd').toLowerCase();

    // Optional: resolve destination account (creator)
    let destination = null;

    if (supabase && recipientHandle) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('stripe_account_id')
          .eq('slug', recipientHandle)
          .maybeSingle();

        if (!error && data?.stripe_account_id) {
          destination = data.stripe_account_id;
        }
      } catch (e) {
        console.warn('Supabase lookup failed; continuing without destination', e);
      }
    }

    // Stripe Checkout line item
    const lineItems = [
      {
        price_data: {
          currency: cur,
          product_data: {
            name: `Thank-you tip for ${recipientHandle || 'creator'}`
          },
          unit_amount: cents
        },
        quantity: 1
      }
    ];

    // Default host and redirect URLs are fully env-driven.
    // Priority:
    //   1) Explicit env overrides for dashboard / cancel
    //   2) NEXT_PUBLIC_THANK_HOST (shared with /api/env.js)
    //   3) Localhost fallback for dev
    const defaultHost =
      process.env.NEXT_PUBLIC_THANK_HOST ||
      process.env.THANK_HOST ||
      'http://localhost:3000';

    const normalizedHost = defaultHost.replace(/\/$/, '');

    const defaultSuccess =
      process.env.HAYLO_DASHBOARD_URL ||
      process.env.NEXT_PUBLIC_HF_DASHBOARD_URL ||
      `${normalizedHost}/your-impact`;

    const defaultCancel =
      process.env.HAYLO_CHECKOUT_CANCEL_URL ||
      process.env.NEXT_PUBLIC_HF_CHECKOUT_CANCEL_URL ||
      normalizedHost;

    const sessionParams = {
      mode: 'payment',
      line_items: lineItems,
      success_url: success_url || `${defaultSuccess}?paid=1`,
      cancel_url: cancel_url || defaultCancel,
      metadata: {
        recipientHandle: recipientHandle || '',
        note: (note || '').slice(0, 180)
      }
    };

    // Route funds to creator if connected
    if (destination) {
      sessionParams.payment_intent_data = {
        transfer_data: { destination }
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return json(res, 200, { url: session.url });
  } catch (err) {
    console.error('create-checkout-session error', err);
    return json(res, 500, { error: 'Failed to create Checkout Session' });
  }
};
