(function (global) {
  'use strict';

  const haylo = global.hayloAuth = global.hayloAuth || {};

  function toAbsolute(urlLike) {
    try {
      return new URL(urlLike, global.location.origin);
    } catch (error) {
      return new URL(global.location.origin);
    }
  }

  function buildRedirectParam(value) {
    if (!value) return '';
    try {
      const url = new URL(value, global.location.origin);
      if (url.origin === global.location.origin) {
        return url.pathname + url.search + url.hash;
      }
      return value;
    } catch (_) {
      return value;
    }
  }

  function getSupabaseClient() {
    if (global.__supabaseClient) return global.__supabaseClient;

    const supabaseLib = global.supabase;
    const url = (global.SUPABASE_URL || '').trim();
    const key = (global.SUPABASE_ANON_KEY || '').trim();

    if (!supabaseLib || typeof supabaseLib.createClient !== 'function') {
      return null;
    }
    if (!url || !key) return null;

    try {
      const client = supabaseLib.createClient(url, key);
      global.__supabaseClient = client;
      return client;
    } catch (error) {
      console.error('hayloAuth: failed to create Supabase client', error);
      return null;
    }
  }

  async function requireSession(options = {}) {
    const client = getSupabaseClient();
    if (!client) {
      return { session: null, status: 'missing-client' };
    }

    const { data, error } = await client.auth.getSession();
    if (error) {
      console.error('hayloAuth: session lookup failed', error);
      return { session: null, status: 'error', error };
    }

    const session = data && data.session ? data.session : null;
    if (!session) {
      const loginPath = options.redirectTo;
      if (loginPath) {
        const loginUrl = toAbsolute(loginPath);
        const redirectBackTo = buildRedirectParam(options.redirectBackTo);
        if (redirectBackTo) {
          loginUrl.searchParams.set('redirect', redirectBackTo);
        }
        global.location.replace(loginUrl.toString());
        return { session: null, status: 'redirected' };
      }
      return { session: null, status: 'no-session' };
    }

    return { session, status: 'allowed' };
  }

  async function requireAdmin(options = {}) {
    const result = await requireSession(options);
    if (result.status !== 'allowed' || !result.session) {
      return result;
    }

    const adminEmail = (options.adminEmail || global.ADMIN_EMAIL || '').trim().toLowerCase();
    if (!adminEmail) {
      return result;
    }

    const sessionEmail = (result.session.user && result.session.user.email || '').trim().toLowerCase();
    if (sessionEmail === adminEmail) {
      return result;
    }

    if (typeof options.onUnauthorized === 'function') {
      try {
        options.onUnauthorized(result.session);
      } catch (error) {
        console.error('hayloAuth: onUnauthorized handler failed', error);
      }
    } else if (options.fallbackUrl) {
      const fallback = toAbsolute(options.fallbackUrl);
      global.location.replace(fallback.toString());
    }

    return { session: null, status: 'unauthorized' };
  }

  async function signOut(options = {}) {
    const client = getSupabaseClient();
    if (!client) return { status: 'missing-client' };

    try {
      await client.auth.signOut(options);
      delete global.__supabaseClient;
      return { status: 'signed-out' };
    } catch (error) {
      console.error('hayloAuth: sign out failed', error);
      return { status: 'error', error };
    }
  }

  haylo.getClient = getSupabaseClient;
  haylo.requireSession = requireSession;
  haylo.requireAdmin = requireAdmin;
  haylo.signOut = signOut;
})(window);
