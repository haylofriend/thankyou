(function (global) {
  const win = global || window;

  function toRelative(target, fallback) {
    const def = typeof fallback === 'string' && fallback ? fallback : '/';
    if (typeof target !== 'string' || !target.trim()) return def;
    try {
      const url = new URL(target, win.location.origin);
      if (url.origin !== win.location.origin) return def;
      return url.pathname + (url.search || '') + (url.hash || '');
    } catch (err) {
      return target.startsWith('/') ? target : def;
    }
  }

  function loginUrl(redirectPath, opts) {
    const loginPath = (opts && opts.loginPath) || win.LOGIN_PATH || '/auth/google';
    const redirect = toRelative(redirectPath, win.location.pathname + win.location.search + win.location.hash);
    const login = new URL(loginPath, win.location.origin);
    login.searchParams.set('redirect', redirect);
    return login;
  }

  let clientPromise = null;
  let sessionCache = null;

  async function ensureClient() {
    if (clientPromise) return clientPromise;

    clientPromise = (async () => {
      const url = (win.SUPABASE_URL || '').trim();
      const key = (win.SUPABASE_ANON_KEY || '').trim();
      if (!url || !key || !win.supabase) return null;
      try {
        return win.supabase.createClient(url, key);
      } catch (err) {
        console.warn('HayloAuth: failed to create Supabase client', err);
        return null;
      }
    })();

    return clientPromise;
  }

  async function currentSession(client) {
    if (!client) return null;
    if (sessionCache) return sessionCache;
    try {
      const { data } = await client.auth.getSession();
      if (data && data.session) {
        sessionCache = data.session;
        return sessionCache;
      }
    } catch (err) {
      console.warn('HayloAuth: getSession failed', err);
    }
    try {
      const { data } = await client.auth.refreshSession();
      if (data && data.session) {
        sessionCache = data.session;
        return sessionCache;
      }
    } catch (err) {
      // Soft fail—refreshSession not always available
    }
    return null;
  }

  async function pollForSession(client, timeoutMs) {
    if (!client) return null;
    const deadline = Date.now() + (typeof timeoutMs === 'number' ? timeoutMs : 0);
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      const session = await currentSession(client);
      if (session) return session;
    }
    return null;
  }

  async function gate(redirectPath, options) {
    try {
      const client = await ensureClient();
      const target = redirectPath || win.location.pathname + win.location.search + win.location.hash;

      if (!client) {
        win.location.replace(loginUrl(target, options).toString());
        return null;
      }

      let session = await currentSession(client);
      if (!session) {
        session = await pollForSession(client, (options && options.pollMs) || 2500);
      }

      if (session) {
        sessionCache = session;
        win.HayloAuth.session = session;
        return session;
      }

      win.location.replace(loginUrl(target, options).toString());
      return null;
    } catch (err) {
      console.warn('HayloAuth: gate failed', err);
      try {
        const fallback = loginUrl(redirectPath, options);
        win.location.replace(fallback.toString());
      } catch (_) {
        // last resort: reload
        win.location.reload();
      }
      return null;
    }
  }

  win.HayloAuth = win.HayloAuth || {};
  win.HayloAuth.gate = gate;
  win.HayloAuth.getClient = async () => ensureClient();
  win.HayloAuth.clearSessionCache = () => { sessionCache = null; };
})(typeof window !== 'undefined' ? window : this);
