// /api/admin-guard.js
// Shared helper to ensure admin-only access for server-side handlers.

const { getUserFromAuthHeader } = require('./_supabase-utils');

function sendJson(res, status, body) {
  if (!res.headersSent) {
    res.statusCode = status;
    res.setHeader('content-type', 'application/json');
  }
  res.end(JSON.stringify(body));
}

async function requireAdmin(req) {
  const user = await getUserFromAuthHeader(req);
  if (!user) {
    return { error: 'Unauthorized', status: 401 };
  }

  const role = user?.role || user?.user_metadata?.role || user?.app_role;
  const isAdmin = role === 'admin' || role === 'super_admin';

  if (!isAdmin) {
    return { error: 'Forbidden', status: 403 };
  }

  return { user };
}

function withAdminGuard(handler) {
  return async (req, res) => {
    try {
      const result = await requireAdmin(req);
      if (!result || result.error) {
        const status = result?.status || 403;
        const message = result?.error || 'Forbidden';
        return sendJson(res, status, { error: message });
      }

      req.adminUser = result.user;
      return handler(req, res);
    } catch (err) {
      console.error('Admin guard failed', err);
      return sendJson(res, 500, { error: 'Internal server error' });
    }
  };
}

module.exports = {
  requireAdmin,
  withAdminGuard
};
