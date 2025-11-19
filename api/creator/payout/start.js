// api/creator/payout/start.js
//
// Starts a creator payout by reserving a pending payout row in the DB.
// This does NOT move money in Stripe yet. It:
//  - Authenticates via Supabase JWT
//  - Verifies the creator has a Stripe Connect account with payouts enabled
//  - Calls public.creator_create_payout(in_creator_id, in_speed)
//  - Returns payout_id + amount_cents + payout_type to the UI

const { supabase, getUserFromAuthHeader } = require('../../_supabase-utils');

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  try {
    // 1) Authenticate via Supabase JWT
    const user = await getUserFromAuthHeader(req);
    if (!user) {
      return json(res, 401, { error: 'Unauthorized' });
    }

    const creatorId = user.id;
    const role = user.user_metadata && user.user_metadata.role;

    // Optional: enforce creator role
    if (role && !['creator', 'admin', 'super_admin'].includes(role)) {
      return json(res, 403, { error: 'Not a creator' });
    }

    // 2) Parse body for desired speed
    let body = {};
    try {
      body = req.body || JSON.parse(req.rawBody || '{}');
    } catch (_) {
      body = {};
    }

    let speed = body.speed === 'instant' ? 'instant' : 'standard';

    // 3) Look up creator profile to ensure they have a Stripe account
    // NOTE: if your table is named something else (e.g. 'creator_profiles'),
    // adjust the .from(...) and .eq(...) lines accordingly.
    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('stripe_account_id, payouts_enabled')
      .eq('id', creatorId)
      .maybeSingle();

    if (profErr) {
      console.error('payout/start profile error', profErr);
      return json(res, 500, { error: 'Profile lookup failed' });
    }

    if (!profile || !profile.stripe_account_id) {
      return json(res, 400, { error: 'No connected Stripe account' });
    }

    if (profile.payouts_enabled === false) {
      return json(res, 400, { error: 'Payouts are not enabled for this account' });
    }

    // 4) Reserve a payout row using the DB function (race-safe)
    const { data: rows, error: rpcErr } = await supabase.rpc(
      'creator_create_payout',
      {
        in_creator_id: creatorId,
        in_speed: speed
      }
    );

    if (rpcErr) {
      const msg = rpcErr.message || '';
      if (msg.includes('NO_FUNDS') || msg.includes('NO_FUNDS_AFTER_FEES')) {
        return json(res, 400, { error: 'No funds available to withdraw' });
      }
      if (msg.includes('BELOW_MINIMUM')) {
        return json(res, 400, { error: 'Balance is below minimum payout amount' });
      }

      console.error('creator_create_payout RPC error', rpcErr);
      return json(res, 500, { error: 'Failed to start payout' });
    }

    const row = Array.isArray(rows) && rows.length ? rows[0] : null;
    if (!row) {
      return json(res, 400, { error: 'No payout created' });
    }

    const payoutId = row.payout_id;
    const amountCents = row.amount_cents;
    const currency = row.currency || 'usd';
    const payoutType = row.payout_type || speed;

    // 5) Respond to the client. STILL no Stripe transfer here.
    return json(res, 200, {
      ok: true,
      speed: payoutType,
      payout_id: payoutId,
      amount_cents: amountCents,
      currency
    });
  } catch (err) {
    console.error('creator/payout/start unexpected error', err);
    return json(res, 500, { error: 'Failed to start payout' });
  }
};
