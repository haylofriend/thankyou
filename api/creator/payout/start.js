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
  stripe,
  supabase,
  parseBody,
  json,
  getUserFromAuthHeader
} = require('../../_stripeShared');

// Helper: normalize Supabase payout reservation errors
function mapPayoutReservationError(supabaseError) {
  if (!supabaseError) return null;

  const { message, details, hint, code } = supabaseError;
  const raw = { message, details, hint, code };

  const combinedText = [message, details, hint]
    .filter(Boolean)
    .join(' | ')
    .toLowerCase();
  const hintText = (hint || '').toLowerCase();
  const codeText = (code || '').toUpperCase();

  if (
    combinedText.includes('no_funds') ||
    hintText.includes('no_funds') ||
    codeText === 'CREATOR_PAYOUT_NO_FUNDS'
  ) {
    return {
      status: 400,
      publicErrorCode: 'NO_FUNDS',
      publicMessage:
        'You do not have any available funds to payout yet. Keep an eye on your dashboard.',
      raw
    };
  }

  if (
    combinedText.includes('below_minimum') ||
    hintText.includes('below_minimum') ||
    codeText === 'CREATOR_PAYOUT_BELOW_MINIMUM'
  ) {
    return {
      status: 400,
      publicErrorCode: 'BELOW_MINIMUM',
      publicMessage:
        'You need to reach the minimum payout amount before cashing out.',
      raw
    };
  }

  if (
    combinedText.includes('no_funds_after_fees') ||
    hintText.includes('no_funds_after_fees') ||
    codeText === 'CREATOR_PAYOUT_NO_FUNDS_AFTER_FEES'
  ) {
    return {
      status: 400,
      publicErrorCode: 'NO_FUNDS_AFTER_FEES',
      publicMessage:
        'Instant payout fees would leave no balance to transfer. Try standard speed instead.',
      raw
    };
  }

  return null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  if (!supabase) {
    return json(res, 500, { error: 'Supabase not configured' });
  }

  try {
    // 1) Who is asking?
    const user = await getUserFromAuthHeader(req);
    if (!user) {
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
      console.warn('payout/start profile error', profileError);
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

    // 5) Reserve a payout row via Supabase (so balances stay consistent)
    let reservation = null;

    try {
      const { data: reserveRows, error: reserveError } = await supabase.rpc(
        'creator_create_payout',
        {
          in_creator_id: user.id,
          in_speed: speed
        }
      );

      if (reserveError) {
        const mappedError = mapPayoutReservationError(reserveError);

        if (mappedError) {
          console.warn('creator_create_payout RPC mapped error', {
            publicErrorCode: mappedError.publicErrorCode,
            ...mappedError.raw
          });
          return json(res, mappedError.status, {
            error: mappedError.publicMessage
          });
        }

        // Unknown error: log everything and return 500
        console.error('creator_create_payout RPC failed', {
          message: reserveError.message,
          details: reserveError.details,
          hint: reserveError.hint,
          code: reserveError.code
        });
        return json(res, 500, { error: 'Failed to reserve payout' });
      }

      reservation = Array.isArray(reserveRows) ? reserveRows[0] : reserveRows;

      if (!reservation || !reservation.payout_id) {
        console.error('creator_create_payout returned no rows', reserveRows);
        return json(res, 500, { error: 'Failed to reserve payout' });
      }
    } catch (err) {
      console.error('creator_create_payout/start error:', err);
      return json(res, 500, { error: 'Failed to start payout' });
    }

    // 6) At this point we know:
    //  - user is authenticated
    //  - user has a connected Stripe Express account
    //  - payouts are enabled
    //  - a payout row was reserved in Supabase (race-safe)

    return json(res, 200, {
      ok: true,
      speed,
      payout: {
        id: reservation.payout_id,
        amount_cents: reservation.amount_cents,
        currency: reservation.currency,
        type: reservation.payout_type
      }
    });
  } catch (err) {
    console.error('creator/payout/start error', err);
    return json(res, 500, { error: 'Failed to start payout' });
  }
};
