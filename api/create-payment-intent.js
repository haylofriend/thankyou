// api/create-payment-intent.js
//
// Handles PaymentRequest (Apple/Google Pay) flow from bloom.html.
// Front-end expects: { clientSecret, requiresAction }

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
  const log = createLogger(req, { route: 'create-payment-intent' });

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
      idempotencyKey: rawIdempotencyKey
    } = parseBody(req);

    const idempotencyKey =
      typeof rawIdempotencyKey === 'string' ? rawIdempotencyKey.trim() : '';
    if (!idempotencyKey) {
      log.warn('Missing idempotencyKey');
      return json(res, 400, { error: 'Missing idempotencyKey' });
    }

    const buyer = await getUserFromAuthHeader(req);

    // Front-end sends "amount" in cents already.
    const rawCents = Number.isFinite(amount) ? Math.round(amount) : 0;

    // Safety clamp: between $1 and $500
    const cents = Math.max(100, Math.min(rawCents, 50000));
    const cur = (currency || 'usd').toLowerCase();

    // Optional: try to resolve a connected account for this creator
    let destination = null;

    if (supabase && recipientHandle) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, stripe_account_id, charges_enabled, payouts_enabled')
          .eq('slug', recipientHandle)
          .maybeSingle();

        if (!error && data && data.stripe_account_id) {
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
        log.warn('Supabase lookup failed, proceeding without destination', {
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

    const params = {
      amount: cents,
      currency: cur,
      payment_method_types: ['card'],
      metadata
    };

    // If we know a connected account, route funds there
    if (destination) {
      params.transfer_data = { destination };
    }

    const applicationFeeAmount = calculateApplicationFeeAmount(cents);
    if (applicationFeeAmount) {
      params.application_fee_amount = applicationFeeAmount;
    }

    const paymentIntent = await stripe.paymentIntents.create(params, {
      idempotencyKey
    });

    return json(res, 200, {
      clientSecret: paymentIntent.client_secret,
      requiresAction: !!paymentIntent.next_action
    });
  } catch (err) {
    log.error('create-payment-intent error', {
      error: err.message,
      stack: err.stack
    });
    return json(res, 500, { error: 'Failed to create PaymentIntent' });
  }
};
