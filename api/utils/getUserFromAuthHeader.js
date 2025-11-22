// api/utils/getUserFromAuthHeader.js
//
// Central helpers for reading Supabase auth from the Authorization header.
// - getAuthResult(req) => { user, token } OR { error, message, status }
// - getUserFromAuthHeader(req) => user | null (legacy, for older callers)
//
// This file never throws; it always returns a structured result.

const { supabase } = require('../_supabaseClient');

/**
 * Normalize the Supabase user into a predictable shape.
 */
function normalizeUser(payload) {
  if (!payload) return null;

  const id = payload.id || payload.sub;

  return {
    id,
    sub: payload.sub || payload.id,
    email: payload.email || null,
    role:
      payload.role ||
      payload.app_metadata?.role ||
      payload.user_metadata?.role ||
      'authenticated',
    aud: payload.aud,
    app_metadata: payload.app_metadata || {},
    user_metadata: payload.user_metadata || {},
    raw: payload,
  };
}

function buildAuthError({ code, message, status = 401 }) {
  return { error: code, message, status };
}

/**
 * Low-level auth helper that never throws.
 *
 * On success:
 *   { user, token }
 *
 * On failure:
 *   { error, message, status }
 */
async function getAuthResult(req) {
  try {
    if (!supabase) {
      console.error('[getAuthResult] Supabase client unavailable');
      return buildAuthError({
        code: 'AUTH_NOT_CONFIGURED',
        message: 'Authentication service unavailable',
        status: 500,
      });
    }

    const header =
      req.headers?.authorization || req.headers?.Authorization || '';

    if (
      typeof header !== 'string' ||
      !header.toLowerCase().startsWith('bearer ')
    ) {
      console.warn('[getAuthResult] Missing or non-bearer Authorization header');
      return buildAuthError({
        code: 'MISSING_TOKEN',
        message: 'Authentication required',
      });
    }

    const token = header.slice('bearer '.length).trim();
    if (!token) {
      console.warn('[getAuthResult] Empty bearer token');
      return buildAuthError({
        code: 'MISSING_TOKEN',
        message: 'Authentication required',
      });
    }

    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data || !data.user) {
      console.warn('[getAuthResult] Failed to get user from token', { error });
      return buildAuthError({
        code: 'INVALID_TOKEN',
        message: 'Authentication required',
      });
    }

    const user = normalizeUser(data.user);

    if (!user || !user.id) {
      console.warn('[getAuthResult] User has no id/sub in payload', {
        payload: data.user,
      });
      return buildAuthError({
        code: 'INVALID_TOKEN',
        message: 'Authentication required',
      });
    }

    return { user, token };
  } catch (err) {
    console.error('[getAuthResult] Unexpected error', {
      message: err && err.message,
      stack: err && err.stack,
    });
    return buildAuthError({
      code: 'AUTH_UNKNOWN_ERROR',
      message: 'Authentication failed',
      status: 500,
    });
  }
}

/**
 * Legacy convenience: returns just `user | null`.
 * Callers that need richer error info should use getAuthResult().
 */
async function getUserFromAuthHeader(req) {
  const result = await getAuthResult(req);
  return result && result.user ? result.user : null;
}

module.exports = {
  getAuthResult,
  getUserFromAuthHeader,
  normalizeUser,
};
