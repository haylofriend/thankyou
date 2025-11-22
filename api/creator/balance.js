// api/creator/balance.js
//
// Read-only endpoint that returns the creator's
// withdrawable balance using the DB function
// public.creator_available_balance(in_creator_id uuid).

const {
  authenticateRequest,
  supabase,
  json,
} = require('../_supabase-utils');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  try {
    // 1) Authenticate via Supabase JWT
    const authResult = await authenticateRequest(req, res);
    if (!authResult || !authResult.user) {
      // authenticateRequest already sent the error response (401/500)
      return;
    }

    const creatorId = authResult.user.id;

    // 2) Ask Postgres for their available balance (in cents)
    const { data, error } = await supabase.rpc(
      'creator_available_balance',
      { in_creator_id: creatorId }
    );

    if (error) {
      console.error('creator_available_balance RPC error', error);
      return json(res, 500, { error: 'Failed to compute balance' });
    }

    // Function returns a table; we expect a single row like:
    // [{ available_cents: 12345, currency: 'usd' }]
    const row = Array.isArray(data) && data.length ? data[0] : data;

    const available_cents = row?.available_cents ?? 0;
    const currency = row?.currency || 'usd';

    return json(res, 200, {
      ok: true,
      available_cents,
      currency,
    });
  } catch (err) {
    console.error('creator/balance error', err);
    return json(res, 500, { error: 'Internal server error' });
  }
};
