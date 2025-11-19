// api/creator/payout/start.js
//
// Kicks off a creator payout in a safe, Stripe-aware way.
// Right now this endpoint:
//   1) Authenticates the creator via Supabase JWT (Authorization: Bearer ...)
//   2) Checks they have a Stripe Connect account
//   3) Verifies payouts are enabled on that account
//   4) Returns { ok: true } so the UI can show the success state
//
// NOTE: We intentionally do NOT move money yet. Plug your own ledger logic
// here later so you never trust client-provided amounts.

const {
  getStripe,
  supabase,
  parseBody,
  json,
  getUserFromAuthHeader,
  createLogger
} = require('../../_stripeShared');

module.exports = async function handler(req, res) {
  const log = createLogger(req, { route: 'creator/payout/start' });

  if (req.method !== 'POST') {
    log.warn('Method not allowed', { method: req.method });
    return json(res, 405, { error: 'Method not allowed' });
  }

  if (!supabase) {
    log.error('Supabase client unavailable');
    return json(res, 500, { error: 'Supabase not configured' });
  }

  try {
    const stripe = getStripe();
    if (!stripe) {
      log.error('Stripe client unavailable');
      return json(res, 500, { error: 'Stripe not configured' });
    }

    // 1) Who is asking?
    const user = await getUserFromAuthHeader(req);
    if (!user) {
      log.warn('Unauthorized request');
      return json(res, 401, { error: 'Unauthorized' });
    }

    // 2) Read and normalize speed from body
    const body = parseBody(req) || {};
    const rawSpeed = body.speed;
    const speed =
      rawSpeed === 'instant' || rawSpeed === 'standard'
        ? rawSpeed
        : 'standard';

    // 3) Look up their profile to find the Stripe Connect account
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, stripe_account_id')
      .eq('id', user.id)
      .single();

    if (profileError) {
      log.warn('Profile lookup failed', { error: profileError.message });
    }

    if (!profile || !profile.stripe_account_id) {
      return json(res, 400, {
        error:
          'Stripe payouts are not connected yet. Please set up your Stripe account first.'
      });
    }

    // 4) Ask Stripe if payouts are actually ready
    const account = await stripe.accounts.retrieve(profile.stripe_account_id);

    if (!account.details_submitted) {
      return json(res, 400, {
        error:
          'Your Stripe account is not fully verified yet. Please finish Stripe onboarding.'
      });
    }

    if (!account.payouts_enabled) {
      return json(res, 400, {
        error:
          'Stripe has your account, but payouts are not enabled yet. Check your Stripe dashboard for next steps.'
      });
    }

    // 5) Reserve a payout row so the ledger is locked in before client UI updates.
    let reservation = null;

    try {
      const { data, error } = await supabase.rpc('creator_create_payout', {
        in_creator_id: user.id,
        in_speed: speed
      });

      if (error) {
        throw error;
      }

      if (Array.isArray(data) && data.length) {
        reservation = data[0];
      } else if (data && data.payout_id) {
        reservation = data;
      }
    } catch (rpcError) {
      const code = (rpcError && rpcError.message) || '';

      if (code.includes('NO_FUNDS')) {
        return json(res, 400, {
          error: 'No funds available for payout yet. Keep an eye on your dashboard.'
        });
      }

      if (code.includes('BELOW_MINIMUM')) {
        return json(res, 400, {
          error: 'You need to earn a bit more before cashing out. Please try again later.'
        });
      }

      if (code.includes('NO_FUNDS_AFTER_FEES')) {
        return json(res, 400, {
          error: 'Instant payout fees would zero out this transfer. Try the standard option.'
        });
      }

      log.error('creator_create_payout RPC failed', {
        error: rpcError.message
      });

      return json(res, 500, { error: 'Failed to reserve payout' });
    }

    if (!reservation) {
      log.error('creator_create_payout returned no data');
      return json(res, 500, { error: 'Failed to reserve payout' });
    }

    return json(res, 200, {
      ok: true,
      speed: reservation.payout_type || speed,
      payoutId: reservation.payout_id,
      amount_cents: reservation.amount_cents,
      currency: reservation.currency
    });
  } catch (err) {
    log.error('creator/payout/start error', {
      error: err.message,
      stack: err.stack
    });
    return json(res, 500, { error: 'Failed to start payout' });
  }
};
