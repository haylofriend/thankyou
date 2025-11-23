// api/creator/payout/start.js
//
// Kicks off a creator payout in a safe, Stripe-aware way.
// This endpoint:
//   1) Authenticates the creator via Supabase JWT (Authorization: Bearer ...)
//   2) Checks they have a Stripe Connect account
//   3) Verifies payouts are enabled on that account
//   4) Reserves a payout row via Supabase (RPC: creator_create_payout)
//   5) Returns { ok: true, payout: {...} } so the UI can show the success state
//
// NOTE: We intentionally do NOT move money yet. That should be handled by your
// own ledger/settlement logic.

const {
  stripe,
  supabase,
  parseBody,
  json,
  authenticateRequest,
} = require('../../_stripeShared');

// Optional: map Supabase RPC errors into user-friendly messages.
function mapPayoutReservationError(error) {
  if (!error) return null;

  const code = error.code || '';
  const message = error.message || '';

  if (code === 'PAYOUT_NOTHING_AVAILABLE') {
    return {
      status: 400,
      publicErrorCode: 'NO_FUNDS',
      publicMessage: 'There is nothing available to pay out yet.',
    };
  }

  // You can extend this for more specific payout errors later.
  return null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  if (!supabase) {
    console.error(
      '[creator/payout/start] Supabase client missing during handler execution'
    );
    return json(res, 500, { error: 'Supabase not configured' });
  }

  try {
    // 1) Who is asking? Authenticate the creator.
    const authResult = await authenticateRequest(req, res);
    if (!authResult || !authResult.user) {
      // authenticateRequest already sent the error response (401/500)
      return;
    }

    const user = authResult.user;

    // 2) Read and normalize payout speed from body
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
      console.warn('creator/payout/start profile error', profileError);
    }

    if (!profile || !profile.stripe_account_id) {
      return json(res, 400, {
        error:
          'Stripe payouts are not connected yet. Please set up your Stripe account first.',
      });
    }

    // 4) Ask Stripe if payouts are actually ready
    const account = await stripe.accounts.retrieve(profile.stripe_account_id);

    if (!account.details_submitted) {
      return json(res, 400, {
        error:
          'Your Stripe account is not fully verified yet. Please finish Stripe onboarding.',
      });
    }

    if (!account.payouts_enabled) {
      return json(res, 400, {
        error:
          'Stripe has your account, but payouts are not enabled yet. Check your Stripe dashboard for next steps.',
      });
    }

    // 5) Reserve a payout row via Supabase (so balances stay consistent)
    const { data: reserveRows, error: reserveError } = await supabase.rpc(
      'creator_create_payout',
      {
        in_creator_id: user.id,
        in_speed: speed,
      }
    );

    if (reserveError) {
      const mapped = mapPayoutReservationError(reserveError);

      if (mapped) {
        console.warn('[creator/payout/start] RPC mapped error', {
          publicErrorCode: mapped.publicErrorCode,
          raw: {
            code: reserveError.code,
            message: reserveError.message,
            details: reserveError.details,
            hint: reserveError.hint,
          },
        });

        return json(res, mapped.status, {
          error: mapped.publicErrorCode,
          message: mapped.publicMessage,
        });
      }

      console.error('[creator/payout/start] Unhandled Supabase RPC error', {
        code: reserveError.code,
        message: reserveError.message,
        details: reserveError.details,
        hint: reserveError.hint,
      });

      return json(res, 500, {
        error: 'PAYOUT_START_FAILED',
        message:
          'Something went wrong while starting your payout. Please try again.',
      });
    }

    const payoutRow = Array.isArray(reserveRows) && reserveRows.length
      ? reserveRows[0]
      : reserveRows;

    if (!payoutRow) {
      console.error('[creator/payout/start] RPC returned no payout row', {
        reserveRows,
      });
      return json(res, 500, { error: 'Failed to reserve payout' });
    }

    return json(res, 200, {
      ok: true,
      payout: {
        id: payoutRow.id,
        amount_cents: payoutRow.amount_cents,
        currency: payoutRow.currency || 'usd',
        type: payoutRow.type || speed,
      },
    });
  } catch (err) {
    console.error('[creator/payout/start] Unexpected error', err);
    return json(res, 500, {
      error: 'PAYOUT_START_FAILED',
      message:
        'Something went wrong while starting your payout. Please try again.',
    });
  }
};
