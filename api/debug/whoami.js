// api/debug/whoami.js
//
// Temporary debug endpoint to understand why JWTs are failing.
// Uses the same getUserFromAuthHeader helper as creator/balance.

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
    const authHeader = req.headers.authorization || req.headers.Authorization;

    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return json(res, 401, { error: 'Missing or malformed Authorization header' });
    }

    const token = authHeader.slice(7).trim();

    // Call the same helper your other APIs use
    const user = await getUserFromAuthHeader(req);

    if (!user) {
      // Try a direct Supabase call so we can see the low-level error
      let directError = null;
      try {
        const { data, error } = await supabase.auth.getUser(token);
        directError = error || (data && !data.user ? 'No user in token' : null);
      } catch (err) {
        directError = err && err.message ? err.message : String(err);
      }

      return json(res, 401, {
        error: 'Unauthorized',
        detail: directError || 'getUserFromAuthHeader returned null'
      });
    }

    // Success: show a safe slice of user info
    return json(res, 200, {
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.user_metadata && user.user_metadata.role,
        aud: user.aud
      }
    });
  } catch (err) {
    console.error('debug/whoami unexpected error', err);
    return json(res, 500, { error: 'Unexpected error', detail: err.message || String(err) });
  }
};
