// api/create-checkout-session.js
//
// Handles Stripe Checkout fallback flow from bloom.html.
// Returns a URL for the user to complete the payment in Stripe Checkout.

const {
  getStripe,
  supabase,
  parseBody,
  json,
  getUserFromAuthHeader,
  calculateApplicationFeeAmount,
  createLogger
} = require('./_stripeShared');

module.exports = async function handler(req, res) {
  const log = createLogger(req, { route: 'create-checkout-session' });

  if (req.method !== 'POST') {
    log.warn('Method not allowed', { method: req.method });
    return json(res, 405, { error: 'Method not allowed' });
  }

  try {
    const stripe = getStripe();
    if (!stripe) {
      log.error('Stripe client unavailable');
      return json(res, 500, { error: 'Stripe not configured' });
    }

    const {
      amount,
      currency,
      recipientHandle,
      note,
      success_url,
      cancel_url,
      idempotencyKey: rawIdempotencyKey
    } = parseBody(req);

    const idempotencyKey =
      typeof rawIdempotencyKey === 'string' ? rawIdempotencyKey.trim() : '';
    if (!idempotencyKey) {
      log.warn('Missing idempotencyKey');
      return json(res, 400, { error: 'Missing idempotencyKey' });
    }

    const buyer = await getUserFromAuthHeader(req);

    // Clamp the amount for safety
    const rawCents = Number.isFinite(amount) ? Math.round(amount) : 0;
    const cents = Math.max(100, Math.min(rawCents, 50000)); // $1–$500
    const cur = (currency || 'usd').toLowerCase();

    // Optional: resolve destination account (creator)
    let destination = null;
    let creatorProfile = null;

    if (supabase && recipientHandle) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, stripe_account_id, charges_enabled, payouts_enabled')
          .eq('slug', recipientHandle)
          .maybeSingle();

        if (!error && data?.stripe_account_id) {
          creatorProfile = data;
          if (data.charges_enabled && data.payouts_enabled) {
            destination = data.stripe_account_id;
          } else {
            log.warn('Creator not eligible for transfers', {
              recipientHandle,
              charges_enabled: data.charges_enabled,
              payouts_enabled: data.payouts_enabled
            });
          }
        }
      } catch (e) {
        log.warn('Supabase lookup failed; continuing without destination', {
          recipientHandle,
          error: e.message
        });
      }
    }

    const metadata = {
      recipientHandle: recipientHandle || '',
      note: (note || '').slice(0, 180)
    };

    if (buyer?.id) {
      metadata.buyer_user_id = buyer.id;
    }
    if (buyer?.email) {
      metadata.buyer_email = buyer.email;
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

    const defaultSuccess = process.env.HAYLO_DASHBOARD_URL
      || 'https://www.haylofriend.com/your-impact';

    const clientReferenceId = (buyer?.id || recipientHandle || 'anon').toString();

    const sessionParams = {
      mode: 'payment',
      line_items: lineItems,
      success_url: success_url || `${defaultSuccess}?paid=1`,
      cancel_url: cancel_url || 'https://www.haylofriend.com',
      metadata,
      client_reference_id: clientReferenceId.slice(0, 40)
    };

    const paymentIntentData = {
      metadata: { ...metadata }
    };

    // Route funds to creator if connected
    if (destination) {
      paymentIntentData.transfer_data = { destination };
    }

    const applicationFeeAmount = calculateApplicationFeeAmount(cents);
    if (applicationFeeAmount) {
      paymentIntentData.application_fee_amount = applicationFeeAmount;
    }

    if (Object.keys(paymentIntentData).length > 0) {
      sessionParams.payment_intent_data = paymentIntentData;
    }

    const session = await stripe.checkout.sessions.create(sessionParams, {
      idempotencyKey
    });

    if (supabase) {
      try {
        await supabase.from('transactions').insert({
          buyer_user_id: buyer?.id || null,
          creator_user_id: creatorProfile?.id || null,
          amount: cents,
          currency: cur,
          app_fee_amount: applicationFeeAmount || null,
          stripe_checkout_sess: session.id,
          stripe_destination_acct: destination,
          status: 'pending',
          kind: 'tip'
        });
      } catch (dbError) {
        log.error('Failed to insert placeholder transaction', {
          error: dbError.message,
          sessionId: session.id
        });
      }
    }

    return json(res, 200, { url: session.url, sessionId: session.id });
  } catch (err) {
    log.error('create-checkout-session error', {
      error: err.message,
      stack: err.stack
    });
    return json(res, 500, { error: 'Failed to create Checkout Session' });
  }
};
