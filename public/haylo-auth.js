/* public/haylo-auth.js — central auth & env helpers (no deps) */
(function (g) {
  const W = (typeof window !== 'undefined') ? window : {};
  const STATE = { supa: null, envLoaded: false, envPromise: null, supabasePromise: null };
  const GET_STARTED = { url: null, redirect: null, observer: null };
  const DEFAULT_GET_STARTED_URL = '/auth/google?redirect=/your-impact';
  const DEFAULT_GET_STARTED_REDIRECT = '/your-impact';

  // -------- Env Loader (reads your /env.js rewrite) --------
  function loadEnv() {
    if (STATE.envPromise) return STATE.envPromise;
    STATE.envPromise = new Promise((resolve) => {
      if (W.NEXT_PUBLIC_SUPABASE_URL && W.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        STATE.envLoaded = true; return resolve();
      }
      const s = document.createElement('script');
      s.src = '/env.js';
      s.onload = () => { STATE.envLoaded = true; resolve(); };
      s.onerror = () => resolve(); // fail-open: pages still work in demo
      document.head.appendChild(s);
    });
    return STATE.envPromise;
  }

  // -------- Supabase Loader + Client Singleton (via CDN) --------
  async function ensureSupabaseLoaded() {
    if (W.supabase) return true;
    if (STATE.supabasePromise) return STATE.supabasePromise;
    if (typeof document === 'undefined') return false;

    const SUPABASE_SRC = (W.SUPABASE_SRC || 'https://unpkg.com/@supabase/supabase-js@2');

    STATE.supabasePromise = new Promise((resolve) => {
      const finalize = (ok) => resolve(ok && !!W.supabase);

      const existing = Array.from(document.querySelectorAll('script[src]'))
        .find((el) => el.src === SUPABASE_SRC);

      if (existing) {
        if (existing.dataset.hayloSupabase === 'failed') {
          existing.remove();
        } else {
          if (existing.dataset.hayloSupabase === 'loaded') {
            finalize(true);
            return;
          }
          existing.addEventListener('load', () => finalize(true), { once: true });
          existing.addEventListener('error', () => {
            existing.dataset.hayloSupabase = 'failed';
            finalize(false);
          }, { once: true });
          return;
        }
      }

      const s = document.createElement('script');
      s.src = SUPABASE_SRC;
      s.async = true;
      s.dataset.hayloSupabase = 'loading';
      s.onload = () => {
        s.dataset.hayloSupabase = 'loaded';
        finalize(true);
      };
      s.onerror = () => {
        s.dataset.hayloSupabase = 'failed';
        finalize(false);
      };
      document.head.appendChild(s);
    });

    const ok = await STATE.supabasePromise;
    if (!ok) STATE.supabasePromise = null;
    return ok;
  }

  function loadSupabase() {
    if (STATE.supabasePromise) return STATE.supabasePromise;
    STATE.supabasePromise = ensureSupabaseLoaded();
    return STATE.supabasePromise;
  }

  function getClient() {
    if (STATE.supa) return STATE.supa;
    const url = (W.NEXT_PUBLIC_SUPABASE_URL || W.SUPABASE_URL || '').trim();
    const key = (W.NEXT_PUBLIC_SUPABASE_ANON_KEY || W.SUPABASE_ANON_KEY || '').trim();
    if (!url || !key || !W.supabase) return null;
    STATE.supa = W.supabase.createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
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

  async function gate(targetPath = dash()) {
    await ensureEnv();

    const SUPABASE_URL = (W.NEXT_PUBLIC_SUPABASE_URL || W.SUPABASE_URL || '').trim();
    const SUPABASE_KEY = (W.NEXT_PUBLIC_SUPABASE_ANON_KEY || W.SUPABASE_ANON_KEY || '').trim();

    function redirectToLogin() {
      // Single auth path: always use Supabase OAuth via login()
      login(targetPath);
      return null;
    }

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return redirectToLogin();
    }

    try {
      const ok = await ensureSupabaseLoaded();
      if (!ok) throw new Error('supabase-js failed to load');
    } catch (err) {
      console.warn('Supabase script failed', err);
      return redirectToLogin();
    }

    const client = getClient();
    if (!client) {
      return redirectToLogin();
    }

    const isOauthReturn = /[?&](code|access_token)=/.test(location.search + location.hash);

    async function waitForSession(ms = 2000) {
      const t0 = Date.now();
      while (Date.now() - t0 < ms) {
        const { data: { session: innerSession } } = await client.auth.getSession();
        if (innerSession) return innerSession;
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
      return null;
    }

    let { data: { session } } = await client.auth.getSession();
    if (!session && isOauthReturn) {
      session = await waitForSession(2000);
      const u = new URL(location.href);
      ['code', 'access_token', 'refresh_token', 'provider_token', 'expires_in', 'token_type', 'scope']
        .forEach((p) => u.searchParams.delete(p));
      history.replaceState({}, '', u.toString());
    }

    if (!session) {
      return redirectToLogin();
    }

    return session;
  }

  async function logout(redirect = '/') {
    await ensureEnv();
    await loadSupabase();
    const supa = getClient();
    if (supa) await supa.auth.signOut();
    location.replace(abs(redirect));
  }

  // -------- Get Started helpers --------
  function getStartedConfig() {
    if (GET_STARTED.url && GET_STARTED.redirect) {
      return { url: GET_STARTED.url, redirect: GET_STARTED.redirect };
    }

    const rawUrl = (W.HF_GET_STARTED_URL || DEFAULT_GET_STARTED_URL);
    const fallbackRedirect = (W.HF_GET_STARTED_REDIRECT || DEFAULT_GET_STARTED_REDIRECT);
    let resolvedUrl = rawUrl;
    let redirectPath = fallbackRedirect;

    try {
      const base = (typeof location !== 'undefined' && location.origin) ? location.origin : 'https://example.com';
      const parsed = new URL(rawUrl, base);
      resolvedUrl = parsed.toString();
      redirectPath = parsed.searchParams.get('redirect') || fallbackRedirect;
    } catch (err) {
      console.warn('HayloAuth: unable to parse HF_GET_STARTED_URL, falling back to defaults.', err);
    }

    GET_STARTED.url = resolvedUrl;
    GET_STARTED.redirect = redirectPath;
    return { url: resolvedUrl, redirect: redirectPath };
  }

  function startGetStartedFlow(event) {
    if (event && typeof event.preventDefault === 'function') {
      event.preventDefault();
    }

    const cfg = getStartedConfig();
    let handled = false;
    try {
      const attempt = login(cfg.redirect);
      handled = true;
      if (attempt && typeof attempt.catch === 'function') {
        attempt.catch(() => { location.href = cfg.url; });
      }
    } catch (err) {
      console.warn('HayloAuth: login failed, falling back to raw URL.', err);
      handled = false;
    }

    if (!handled) {
      location.href = cfg.url;
    }
    return false;
  }

  function handleGetStartedKey(event) {
    const key = event.key || event.code;
    if (key === 'Enter' || key === ' ') {
      startGetStartedFlow(event);
    }
  }

  function applyGetStartedBehavior(el) {
    if (!el || el.nodeType !== 1 || el.__hayloGetStarted) return;
    const cfg = getStartedConfig();

    try {
      if (typeof el.setAttribute === 'function') {
        const tag = (el.tagName || '').toLowerCase();
        if (tag === 'a' || el.hasAttribute('href')) {
          el.setAttribute('href', cfg.url);
        } else {
          if (!el.getAttribute('role')) el.setAttribute('role', 'button');
          if (!el.getAttribute('tabindex')) el.setAttribute('tabindex', '0');
        }
        el.setAttribute('data-get-started-ready', '1');
      }
    } catch (_) {}

    try {
      el.addEventListener('click', startGetStartedFlow);
      const tag = (el.tagName || '').toLowerCase();
      if (tag !== 'a' && tag !== 'button') {
        el.addEventListener('keydown', handleGetStartedKey);
      }
    } catch (_) {}

    el.__hayloGetStarted = true;
  }

  function wireGetStartedButtons(scope) {
    const root = scope || (typeof document !== 'undefined' ? document : null);
    if (!root) return [];

    const wired = [];
    const seen = new Set();

    function enqueue(el) {
      if (!el || seen.has(el) || !el.getAttribute || !el.hasAttribute('data-get-started')) return;
      seen.add(el);
      applyGetStartedBehavior(el);
      wired.push(el);
    }

    if (root.nodeType === 1 && typeof root.matches === 'function' && root.matches('[data-get-started]')) {
      enqueue(root);
    }

    if (typeof root.querySelectorAll === 'function') {
      root.querySelectorAll('[data-get-started]').forEach((el) => enqueue(el));
    }

    return wired;
  }

  function monitorGetStartedButtons() {
    if (typeof document === 'undefined') return;

    const ready = () => {
      wireGetStartedButtons(document);

      if (typeof MutationObserver === 'function' && !GET_STARTED.observer) {
        const observer = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
              mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) wireGetStartedButtons(node);
              });
            } else if (mutation.type === 'attributes' && mutation.target) {
              wireGetStartedButtons(mutation.target);
            }
          });
        });

        observer.observe(document.documentElement || document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['data-get-started']
        });

        GET_STARTED.observer = observer;
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', ready, { once: true });
    } else {
      ready();
    }
  }

  // expose
  const api = {
    ensureEnv,
    getClient,
    whoami,
    login,
    gate,
    logout,
    buildAuthorizeUrl,
    dash,
    loginPath,
    ensureSupabaseLoaded,
    getStartedConfig,
    startGetStartedFlow,
    wireGetStartedButtons
  };

  g.HayloAuth = api;

  monitorGetStartedButtons();

  function emitReady(target) {
    if (!target || typeof target.dispatchEvent !== 'function') return;
    let evt;
    try {
      evt = new CustomEvent('hayloauth:ready', { detail: g.HayloAuth });
    } catch (_) {
      if (typeof document !== 'undefined' && typeof document.createEvent === 'function') {
        evt = document.createEvent('Event');
        evt.initEvent('hayloauth:ready', false, false);
        evt.detail = g.HayloAuth;
      }
    }
    if (evt) target.dispatchEvent(evt);
  }

  emitReady(typeof window !== 'undefined' ? window : null);
  emitReady(typeof document !== 'undefined' ? document : null);
})(window);
