/* public/haylo-auth.js — unified auth helper (uses LOGIN_PATH + Supabase) */
(function (g) {
  var W = (typeof window !== "undefined") ? window : {};
  var STATE = {
    envLoaded: false,
    envPromise: null,
    supabasePromise: null,
    supa: null
  };

  // -------- Env Loader (reads /env.js which sets window.LOGIN_PATH, SUPABASE_URL, etc.) --------
  function loadEnv() {
    if (STATE.envPromise) return STATE.envPromise;

    STATE.envPromise = new Promise(function (resolve) {
      // If env already present, don't load again
      if ((W.SUPABASE_URL && W.SUPABASE_ANON_KEY) || STATE.envLoaded) {
        STATE.envLoaded = true;
        return resolve();
      }
      if (typeof document === "undefined") {
        STATE.envLoaded = true;
        return resolve();
      }
      var existing = document.querySelector('script[data-haylo-env]');
      if (existing) {
        existing.addEventListener("load", function () {
          STATE.envLoaded = true;
          resolve();
        }, { once: true });
        existing.addEventListener("error", function () {
          resolve();
        }, { once: true });
        return;
      }
      var s = document.createElement("script");
      s.src = "/env.js";
      s.async = true;
      s.dataset.hayloEnv = "true";
      s.addEventListener("load", function () {
        STATE.envLoaded = true;
        resolve();
      }, { once: true });
      s.addEventListener("error", function () {
        resolve();
      }, { once: true });
      document.head.appendChild(s);
    });

    return STATE.envPromise;
  }

  // -------- Supabase Loader (lazy-load CDN build if needed) --------
  function loadSupabase() {
    if (STATE.supabasePromise) return STATE.supabasePromise;

    STATE.supabasePromise = new Promise(function (resolve) {
      loadEnv().then(function () {
        var url = (W.SUPABASE_URL || "").trim();
        var key = (W.SUPABASE_ANON_KEY || "").trim();
        if (!url || !key) {
          console.warn("HayloAuth: missing SUPABASE_URL or SUPABASE_ANON_KEY");
          return resolve(false);
        }

        function createClientIfPossible() {
          try {
            if (g.supabase && typeof g.supabase.createClient === "function") {
              STATE.supa = g.supabase.createClient(url, key);
              return resolve(true);
            }
          } catch (err) {
            console.error("HayloAuth: supabase.createClient failed", err);
          }
          resolve(false);
        }

        // If supabase already loaded globally
        if (g.supabase && typeof g.supabase.createClient === "function") {
          return createClientIfPossible();
        }

        if (typeof document === "undefined") {
          return resolve(false);
        }

        var existing = document.querySelector("script[data-haylo-supabase]");
        if (existing) {
          existing.addEventListener("load", function () {
            createClientIfPossible();
          }, { once: true });
          existing.addEventListener("error", function () {
            resolve(false);
          }, { once: true });
          return;
        }

        var s = document.createElement("script");
        s.src = "https://unpkg.com/@supabase/supabase-js@2";
        s.async = true;
        s.dataset.hayloSupabase = "true";
        s.addEventListener("load", function () {
          createClientIfPossible();
        }, { once: true });
        s.addEventListener("error", function () {
          console.error("HayloAuth: failed to load supabase-js");
          resolve(false);
        }, { once: true });
        document.head.appendChild(s);
      });
    });

    return STATE.supabasePromise;
  }

  function getClient() {
    return STATE.supa || null;
  }

  // -------- Helpers --------
  function currentOrigin() {
    try {
      if (typeof location !== "undefined" && location.origin) return location.origin;
    } catch (_) {}
    return "https://www.haylofriend.com";
  }

  function abs(path) {
    try {
      return new URL(path, currentOrigin()).toString();
    } catch (_) {
      if (!path) return currentOrigin() + "/";
      if (path.charAt(0) === "/") return currentOrigin() + path;
      return currentOrigin() + "/" + path;
    }
  }

  function dash() {
    return (W.HF_DASHBOARD_URL || "/your-impact");
  }

  function canonicalLoginPath(raw) {
    var fallback = "/auth/google";
    if (typeof raw !== "string") return fallback;
    var value = raw.trim();
    if (!value) return fallback;
    if (value.startsWith("http://") || value.startsWith("https://")) {
      try {
        var url = new URL(value, currentOrigin());
        if (url.origin !== currentOrigin()) return fallback;
        return url.pathname + (url.search || "") + (url.hash || "");
      } catch (_) {
        return fallback;
      }
    }
    if (value.charAt(0) !== "/") return fallback;
    return value;
  }

  function getLoginPath() {
    var envLogin = null;
    try {
      if (W.__ENV__ && typeof W.__ENV__.HF_LOGIN_PATH === "string") {
        envLogin = W.__ENV__.HF_LOGIN_PATH;
      }
    } catch (_) {}

    if (!envLogin) {
      try {
        if (typeof process !== "undefined" && process.env && process.env.NEXT_PUBLIC_HF_LOGIN_PATH) {
          envLogin = process.env.NEXT_PUBLIC_HF_LOGIN_PATH;
        }
      } catch (_) {}
    }

    if (!envLogin && typeof W.HF_LOGIN_PATH === "string") {
      envLogin = W.HF_LOGIN_PATH;
    }

    if (!envLogin && typeof W.LOGIN_PATH === "string") {
      envLogin = W.LOGIN_PATH;
    }

    return canonicalLoginPath(envLogin || "/auth/google");
  }

  function normalizeRedirect(raw, fallbackPath) {
    var fallback = fallbackPath || dash();
    
    // Prefer the shared HayloRedirect logic if present
    try {
      if (typeof window !== "undefined" &&
          window.HayloRedirect &&
          typeof window.HayloRedirect.normalize === "function") {
        return window.HayloRedirect.normalize(raw, fallback);
      }
    } catch (_) {
      // fall back to local behavior
    }

    // Local, same-origin-only fallback (no whitelist)
    if (!raw) return fallback;
    try {
      var base = currentOrigin();
      var u = new URL(raw, base);
      if (u.origin !== base) return fallback;
      return u.pathname + (u.search || "") + (u.hash || "");
    } catch (_) {
      return fallback;
    }
  }

  function samePath(a, b) {
    try {
      var base = window.location.origin;
      var ua = new URL(a, base);
      var ub = new URL(b, base);

      var normalize = function (p) {
        return p.replace(/\/+$/, "") || "/";
      };
      return normalize(ua.pathname) === normalize(ub.pathname);
    } catch (e) {
      // Fallback: plain string compare if URL parsing fails
      return a === b;
    }
  }

  // -------- Public methods --------
  async function whoami() {
    await loadEnv();
    var ok = await loadSupabase();
    if (!ok) return { user: null, session: null, ready: false };
    var supa = getClient();
    if (!supa) return { user: null, session: null, ready: false };
    try {
      var result = await supa.auth.getSession();
      var session = result && result.data && result.data.session || null;
      return { user: session ? session.user : null, session: session, ready: true };
    } catch (err) {
      console.error("HayloAuth.whoami error", err);
      return { user: null, session: null, ready: false };
    }
  }

  async function login(redirectPath) {
    await loadEnv();

    var fallback = dash();
    var targetPath = normalizeRedirect(redirectPath || fallback, fallback);
    var loginPath = getLoginPath();

    try {
      var info = await whoami();
      if (info && info.session && info.user) {
        // already logged in, go straight to target
        location.replace(abs(targetPath));
        return;
      }
    } catch (err) {
      console.warn("HayloAuth.login: whoami failed, falling back to login redirect", err);
    }

    try {
      var url = new URL(loginPath, currentOrigin());
      url.searchParams.set("redirect", targetPath);
      location.replace(url.toString());
    } catch (err2) {
      console.error("HayloAuth.login redirect error", err2);
      location.replace(loginPath + "?redirect=" + encodeURIComponent(targetPath));
    }
  }

  async function logout(redirectPath) {
    await loadEnv();
    var ok = await loadSupabase();
    if (ok) {
      try {
        var supa = getClient();
        if (supa) await supa.auth.signOut();
      } catch (err) {
        console.warn("HayloAuth.logout signOut failed", err);
      }
    }
    var target = normalizeRedirect(redirectPath || "/", "/");
    location.replace(abs(target));
  }

  async function gate(targetPath) {
    await loadEnv();
    var loginPath = getLoginPath();
    var fallback = dash();
    var path = targetPath || (typeof location !== "undefined"
      ? (location.pathname + (location.search || "") + (location.hash || ""))
      : fallback);
    var normalized = normalizeRedirect(path, fallback);
    var ok = await loadSupabase();

    function overlayEl() {
      if (typeof document === "undefined") return null;
      var el = document.querySelector("[data-hayloauth-overlay]");
      if (el) return el;
      el = document.getElementById("hayloauth-overlay");
      if (el) return el;
      var created = document.createElement("div");
      created.id = "hayloauth-overlay";
      created.dataset.hayloauthOverlay = "true";
      created.style.position = "fixed";
      created.style.inset = "0";
      created.style.display = "none";
      created.style.alignItems = "center";
      created.style.justifyContent = "center";
      created.style.background = "rgba(0,0,0,0.7)";
      created.style.zIndex = "9999";
      created.innerHTML = '<div style="padding:16px 20px;border-radius:14px;background:rgba(18,18,20,0.9);color:white;font-family:-apple-system,BlinkMacSystemFont,\"SF Pro Text\",\"Helvetica Neue\",Arial,sans-serif;">Checking sign-in…</div>';
      try {
        document.body.appendChild(created);
      } catch (_) {}
      return created;
    }

    function showOverlay() {
      var el = overlayEl();
      if (el) el.style.display = "flex";
    }

    function hideOverlay() {
      var el = overlayEl();
      if (el) el.style.display = "none";
    }

    function redirectToLogin() {
      var currentPath = (typeof window !== "undefined" && window.location)
        ? (window.location.pathname + (window.location.search || ""))
        : normalized;
      var redirect = encodeURIComponent(currentPath || "/your-impact");
      var loginUrl = loginPath + "?redirect=" + redirect;
      console.warn("[HayloAuth] redirectToLogin →", loginUrl);

      var currentUrl = (typeof window !== "undefined" && window.location && window.location.href)
        ? window.location.href
        : "";

      if (currentUrl && samePath(currentUrl, loginPath)) {
        console.warn("[HayloAuth] Not redirecting: already on LOGIN_PATH, showing logged-out view instead.");
        hideOverlay();
        return;
      }

      var LOOP_KEY = "hayloauth:lastRedirect";
      var now = Date.now();
      var last = 0;
      try {
        last = parseInt(sessionStorage.getItem(LOOP_KEY) || "0", 10) || 0;
      } catch (_) {
        last = 0;
      }

      if (now - last < 3000) {
        console.warn("[HayloAuth] Possible redirect loop detected. Not redirecting again.");
        hideOverlay();
        return;
      }

      try {
        sessionStorage.setItem(LOOP_KEY, String(now));
      } catch (_) {}

      window.location.href = loginUrl;
    }

    showOverlay();

    if (!ok) {
      // no Supabase client, send to login
      redirectToLogin();
      return;
    }

    try {
      var supa = getClient();
      if (!supa) throw new Error("no supabase client");

      console.log("[HayloAuth] Starting auth gate check");
      var result = await supa.auth.getSession();
      if (result && result.error) {
        console.error("[HayloAuth] getSession error", result.error);
        redirectToLogin();
        return;
      }

      var session = result && result.data && result.data.session || null;
      if (session && session.user) {
        console.log("[HayloAuth] Session found", { userId: session.user.id });
        try {
          sessionStorage.removeItem("hayloauth:lastRedirect");
        } catch (_) {}
        hideOverlay();
        return session.user;
      }

      console.warn("[HayloAuth] No session found; redirecting to login");
      redirectToLogin();
    } catch (err) {
      console.error("[HayloAuth] Unexpected auth gate error", err);
      redirectToLogin();
    }
  }

  function buildAuthorizeUrl(redirectPath) {
    // In unified mode, this just builds the /auth/google?redirect=... URL
    var fallback = dash();
    var target = normalizeRedirect(redirectPath || fallback, fallback);
    var loginPath = getLoginPath();
    try {
      var u = new URL(loginPath, currentOrigin());
      u.searchParams.set("redirect", target);
      return u.toString();
    } catch (_) {
      return loginPath + "?redirect=" + encodeURIComponent(target);
    }
  }

  // -------- Export public API --------
  var api = {
    ensureEnv: loadEnv,
    ensureSupabase: loadSupabase,
    getClient: getClient,
    whoami: whoami,
    getUser: async function () {
      var info = await whoami();
      return info.user;
    },
    login: login,
    logout: logout,
    gate: gate,
    buildAuthorizeUrl: buildAuthorizeUrl,
    LOGIN_PATH: function () { return getLoginPath(); },
    DASHBOARD_PATH: function () { return dash(); }
  };

  g.HayloAuth = api;

  // Fire a ready event for anyone listening
  function emitReady(target) {
    if (!target || !target.dispatchEvent) return;
    var evt;
    try {
      evt = new CustomEvent("hayloauth:ready", { detail: api });
    } catch (_) {
      if (typeof document !== "undefined" && typeof document.createEvent === "function") {
        evt = document.createEvent("Event");
        evt.initEvent("hayloauth:ready", false, false);
        evt.detail = api;
      }
    }
    if (evt) target.dispatchEvent(evt);
  }

  try {
    emitReady(typeof window !== "undefined" ? window : null);
    emitReady(typeof document !== "undefined" ? document : null);
  } catch (_) {}

})(window);
