/* public/haylo-auth.js — central auth & env helpers (no deps) */
(function (g) {
  const W = (typeof window !== 'undefined') ? window : {};
  const STATE = { supa: null, envLoaded: false, envPromise: null, supabasePromise: null };

  // -------- Env Loader (reads your /api/env.js) --------
  function loadEnv() {
    if (STATE.envPromise) return STATE.envPromise;
    STATE.envPromise = new Promise((resolve) => {
      if (W.NEXT_PUBLIC_SUPABASE_URL && W.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        STATE.envLoaded = true; return resolve();
      }
      const s = document.createElement('script');
      s.src = '/api/env.js';  // already routed by vercel.json
      s.onload = () => { STATE.envLoaded = true; resolve(); };
      s.onerror = () => resolve(); // fail-open: pages still work in demo
      document.head.appendChild(s);
    });
    return STATE.envPromise;
  }

  // -------- Supabase Loader + Client Singleton (via CDN) --------
  function loadSupabase() {
    if (STATE.supabasePromise) return STATE.supabasePromise;
    if (W.supabase) {
      STATE.supabasePromise = Promise.resolve(true);
      return STATE.supabasePromise;
    }
    STATE.supabasePromise = new Promise((resolve) => {
      if (typeof document === 'undefined') { resolve(false); return; }
      const existing = document.querySelector('script[data-haylo-supabase]');
      if (existing) {
        if (existing.dataset.loaded === 'true') { resolve(!!W.supabase); return; }
        existing.addEventListener('load', () => { existing.dataset.loaded = 'true'; resolve(!!W.supabase); }, { once: true });
        existing.addEventListener('error', () => resolve(false), { once: true });
        return;
      }
      const s = document.createElement('script');
      s.src = (W.SUPABASE_SRC || 'https://unpkg.com/@supabase/supabase-js@2');
      s.async = false;
      s.dataset.hayloSupabase = 'true';
      s.addEventListener('load', () => { s.dataset.loaded = 'true'; resolve(!!W.supabase); }, { once: true });
      s.addEventListener('error', () => resolve(false), { once: true });
      document.head.appendChild(s);
    });
    return STATE.supabasePromise;
  }

  function getClient() {
    if (STATE.supa) return STATE.supa;
    const url = (W.NEXT_PUBLIC_SUPABASE_URL || W.SUPABASE_URL || '').trim();
    const key = (W.NEXT_PUBLIC_SUPABASE_ANON_KEY || W.SUPABASE_ANON_KEY || '').trim();
    if (!url || !key || !W.supabase) return null;
    STATE.supa = W.supabase.createClient(url, key);
    return STATE.supa;
  }

  // -------- URL helpers --------
  function abs(urlOrPath) {
    try { return new URL(urlOrPath, location.origin).toString(); } catch { return location.origin; }
  }
  function dash() {
    return (W.HF_DASHBOARD_URL || '/your-impact');
  }
  function loginPath() {
    // canonical entry (works with your rewrites)
    return (W.LOGIN_PATH || '/auth/google');
  }
  function buildAuthorizeUrl(redirectPath) {
    const proj = (W.NEXT_PUBLIC_SUPABASE_URL || W.SUPABASE_URL || '').replace(/\/+$/, '');
    const target = abs(redirectPath || dash());
    const u = new URL('/auth/v1/authorize', proj);
    u.searchParams.set('provider', 'google');
    u.searchParams.set('redirect_to', target);
    return u.toString();
  }

  // -------- Public API --------
  async function ensureEnv() { await loadEnv(); return true; }

  async function whoami() {
    await ensureEnv();
    const supaReady = await loadSupabase();
    const supa = getClient();
    if (!supaReady || !supa) return { user: null, session: null, ready: false };
    const { data: { session } } = await supa.auth.getSession();
    return { user: session?.user ?? null, session: session ?? null, ready: true };
  }

  async function login(redirect = dash()) {
    await ensureEnv();
    // If already signed in, just go
    const { session } = await whoami();
    if (session) { location.replace(abs(redirect)); return; }
    // Send to Supabase authorize
    location.replace(buildAuthorizeUrl(redirect));
  }

  async function gate(redirect = dash()) {
    // Call at top of any protected page
    await ensureEnv();

    const supaUrl = (W.NEXT_PUBLIC_SUPABASE_URL || W.SUPABASE_URL || '').trim();
    const supaKey = (W.NEXT_PUBLIC_SUPABASE_ANON_KEY || W.SUPABASE_ANON_KEY || '').trim();

    // Fail-safe: if Supabase isn't configured or ready, send user to login with redirect
    if (!W.supabase || !supaUrl || !supaKey) {
      const failover = new URL(loginPath(), location.origin);
      failover.searchParams.set('redirect', redirect);
      location.replace(failover.toString());
      return;
    }

    const { session } = await whoami();
    if (!session) {
      const go = new URL(loginPath(), location.origin);
      go.searchParams.set('redirect', redirect);
      location.replace(go.toString());
    }
  }

  async function logout(redirect = '/') {
    await ensureEnv();
    await loadSupabase();
    const supa = getClient();
    if (supa) await supa.auth.signOut();
    location.replace(abs(redirect));
  }

  // expose
  g.HayloAuth = { ensureEnv, getClient, whoami, login, gate, logout, buildAuthorizeUrl, dash, loginPath };
})(window);
