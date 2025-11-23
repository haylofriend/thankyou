// api/debug/whoami.js
//
// Temporary debug endpoint to understand why JWTs are failing.
// Uses the same getUserFromAuthHeader helper as creator/balance.

const { authenticateRequest, respondAuthError } = require('../_supabase-utils');

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
    const authResult = await authenticateRequest(req);

    if (!authResult || !authResult.user) {
      return respondAuthError(res, authResult);
    }

    // Success: show a safe slice of user info
    return json(res, 200, {
      ok: true,
      user: {
        id: authResult.user.id,
        email: authResult.user.email,
        role:
          authResult.user.user_metadata && authResult.user.user_metadata.role,
        aud: authResult.user.aud
      }
    });
  } catch (err) {
    console.error('debug/whoami unexpected error', err);
    return json(res, 500, { error: 'Unexpected error', detail: err.message || String(err) });
  }
};
