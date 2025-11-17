// api/creator/balance.js
//
// Read-only endpoint that returns the creator's
// withdrawable balance using the DB function
// public.creator_available_balance(in_creator_id uuid).

const { getUserFromAuthHeader, supabase } = require('../_supabase-utils');

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  try {
    // 1) Authenticate via Supabase JWT (same as other creator endpoints)
    const user = await getUserFromAuthHeader(req);
    if (!user) {
      return json(res, 401, { error: 'Unauthorized' });
    }

    const creatorId = user.id;

    // use the shared server-side Supabase client

    const { data, error } = await supabase
      .rpc('creator_available_balance', { in_creator_id: creatorId });

    if (error) {
      console.error('creator_available_balance RPC error', error);
      return json(res, 500, { error: 'Failed to compute balance' });
    }

    // Function returns a table; we expect a single row like:
    // [{ available_cents: 12345, currency: 'usd' }]
    const row = Array.isArray(data) && data.length ? data[0] : null;

    const available_cents = row ? row.available_cents : 0;
    const currency = row ? (row.currency || 'usd') : 'usd';

    return json(res, 200, {
      ok: true,
      available_cents,
      currency
    });
  } catch (err) {
    console.error('creator/balance error', err);
    return json(res, 500, { error: 'Unexpected error' });
  }
};
