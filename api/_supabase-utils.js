// api/_supabase-utils.js
// Unified Supabase helpers for all API routes.

const { supabase } = require('./_supabaseClient');
const { getAuthResult, getUserFromAuthHeader } = require('./utils/getUserFromAuthHeader');

function json(res, status, body) {
  if (!res.headersSent) {
    res.statusCode = status;
    res.setHeader('content-type', 'application/json; charset=utf-8');
  }
  res.end(JSON.stringify(body));
}

/**
 * Standardized auth error responder.
 */
function respondAuthError(res, authResult) {
  return json(res, authResult?.status || 401, {
    error: authResult?.error || 'UNAUTHENTICATED',
    message: authResult?.message || 'Authentication required',
  });
}

/**
 * High-level helper to authenticate a request.
 *
 * Returns:
 *   { user, token } on success
 *   { error, message, status } on failure
 *
 * If `res` is provided and the request is unauthenticated, this will also
 * send the error response.
 */
async function authenticateRequest(req, res) {
  const authResult = await getAuthResult(req);

  if (authResult && authResult.user) {
    return authResult;
  }

  if (res) {
    respondAuthError(res, authResult);
  }

  return authResult;
}

module.exports = {
  supabase,
  json,
  authenticateRequest,
  respondAuthError,
  getUserFromAuthHeader,
};
