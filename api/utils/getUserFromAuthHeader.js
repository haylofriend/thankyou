// api/utils/getUserFromAuthHeader.js
//
// Reads the Authorization: Bearer <jwt> header, validates it with Supabase,
// and returns a normalized `user` object (or null on failure).
//
// NOTE:
// - Never throws. All errors are logged and result in `null`.
// - Normalizes ID so callers can safely use `user.id`.

const { supabase } = require('../_supabaseClient'); // or your shared supabase module

async function getUserFromAuthHeader(req) {
  try {
    const authHeader =
      req.headers.authorization || req.headers.Authorization || '';

    if (!authHeader.toLowerCase().startsWith('bearer ')) {
      console.warn('[getUserFromAuthHeader] Missing or non-bearer Authorization header');
      return null;
    }

    const token = authHeader.slice('bearer '.length).trim();
    if (!token) {
      console.warn('[getUserFromAuthHeader] Empty bearer token');
      return null;
    }

    // Validate token with Supabase
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data || !data.user) {
      console.warn('[getUserFromAuthHeader] Failed to get user from token', {
        error,
      });
      return null;
    }

    const payload = data.user;

    // Normalize user shape so downstream code can safely use user.id
    const user = {
      id: payload.id || payload.sub, // <----- critical fix
      sub: payload.sub || payload.id,
      email: payload.email,
      role:
        payload.role ||
        payload.app_metadata?.role ||
        'authenticated',
      app_metadata: payload.app_metadata || {},
      user_metadata: payload.user_metadata || {},
      raw: payload,
    };

    if (!user.id) {
      console.warn('[getUserFromAuthHeader] User has no id/sub in payload', {
        payload,
      });
      return null;
    }

    return user;
  } catch (err) {
    console.error('[getUserFromAuthHeader] Unexpected error', {
      message: err && err.message,
      stack: err && err.stack,
    });
    return null;
  }
}

module.exports = {
  getUserFromAuthHeader,
};
