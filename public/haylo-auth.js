(function (global) {
  if (global.HayloAuth && typeof global.HayloAuth.gate === 'function') {
    return;
  }

  var DEFAULT_LOGIN_PATH = '/auth/google';
  var DEFAULT_REDIRECT = '/your-impact';
  var client = null;
  var redirectIssued = false;

  function normalizeRedirect(target) {
    if (!target) {
      return (location.pathname + (location.search || '') + (location.hash || '')) || DEFAULT_REDIRECT;
    }

    try {
      var url = new URL(target, location.origin);
      if (url.origin === location.origin) {
        return url.pathname + (url.search || '') + (url.hash || '');
      }
    } catch (_) {
      // ignore, fall through to string handling below
    }

    if (target.charAt(0) !== '/') {
      return '/' + target.replace(/^\/+/, '');
    }

    return target;
  }

  function buildLoginUrl(target) {
    var loginPath = (global.LOGIN_PATH || '').trim() || DEFAULT_LOGIN_PATH;
    try {
      var url = new URL(loginPath, location.origin);
      if (target) {
        url.searchParams.set('redirect', target);
      }
      return url.toString();
    } catch (_) {
      var base = loginPath;
      if (!target) return base;
      return base + (base.indexOf('?') === -1 ? '?' : '&') + 'redirect=' + encodeURIComponent(target);
    }
  }

  function redirectToLogin(target) {
    if (redirectIssued) return;
    redirectIssued = true;
    var url = buildLoginUrl(target || DEFAULT_REDIRECT);
    try {
      location.replace(url);
    } catch (_) {
      location.href = url;
    }
  }

  function ensureClient() {
    if (client) return client;
    if (global.__supabaseClient) {
      client = global.__supabaseClient;
      return client;
    }

    var supabaseUrl = (global.SUPABASE_URL || '').trim();
    var supabaseKey = (global.SUPABASE_ANON_KEY || '').trim();

    if (!global.supabase || !supabaseUrl || !supabaseKey) {
      return null;
    }

    try {
      client = global.supabase.createClient(supabaseUrl, supabaseKey);
      global.__supabaseClient = client;
    } catch (err) {
      console.warn('HayloAuth: failed to create Supabase client', err);
      client = null;
    }

    return client;
  }

  async function gate(target) {
    var redirectTarget = normalizeRedirect(target || global.HF_DASHBOARD_URL || DEFAULT_REDIRECT);
    try {
      var supabaseClient = ensureClient();
      if (!supabaseClient) {
        redirectToLogin(redirectTarget);
        return { redirected: true, session: null };
      }

      var response = await supabaseClient.auth.getSession();
      var session = response && response.data ? response.data.session : null;
      if (!session) {
        redirectToLogin(redirectTarget);
        return { redirected: true, session: null };
      }

      return { redirected: false, session: session };
    } catch (error) {
      console.warn('HayloAuth.gate failed', error);
      redirectToLogin(redirectTarget);
      return { redirected: true, session: null, error: error };
    }
  }

  global.HayloAuth = {
    gate: gate,
    redirectToLogin: redirectToLogin,
    ensureClient: ensureClient
  };
})(window);
