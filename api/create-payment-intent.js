// api/create-payment-intent.js
//
// Handles PaymentRequest (Apple/Google Pay) flow from bloom.html.
// Front-end expects: { clientSecret, requiresAction }

const { stripe, supabase, parseBody, json } = require('./_stripeShared');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  try {
    const { amount, currency, recipientHandle, note } = parseBody(req);

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
          .select('stripe_account_id')
          .eq('slug', recipientHandle)
          .maybeSingle();

        if (!error && data && data.stripe_account_id) {
          destination = data.stripe_account_id;
        }
      } catch (e) {
        console.warn('Supabase lookup failed, proceeding without destination', e);
      }
    }

    const params = {
      amount: cents,
      currency: cur,
      payment_method_types: ['card'],
      metadata: {
        recipientHandle: recipientHandle || '',
        note: (note || '').slice(0, 180)
      }
    };

    // If we know a connected account, route funds there
    if (destination) {
      params.transfer_data = { destination };
      // Optional: you can set application_fee_amount here for platform fees.
    }

    const paymentIntent = await stripe.paymentIntents.create(params);

    return json(res, 200, {
      clientSecret: paymentIntent.client_secret,
      requiresAction: !!paymentIntent.next_action
    });
  } catch (err) {
    console.error('create-payment-intent error', err);
    return json(res, 500, { error: 'Failed to create PaymentIntent' });
  }
};
