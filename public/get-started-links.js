// public/get-started-links.js
// Sets all [data-get-started] links to the ONE canonical login path
// LOGIN_PATH (default: /auth/google) + ?redirect=<dashboard>

(function () {
  var DEFAULT_REDIRECT = "/your-impact";

  function canonicalLoginPath(raw) {
    var fallback = "/auth/google";
    if (typeof raw !== "string") return fallback;
    var value = raw.trim();
    if (!value) return fallback;
    if (value.startsWith("http://") || value.startsWith("https://")) {
      try {
        var origin = typeof location !== "undefined" && location.origin ? location.origin : "";
        var url = new URL(value, origin || "https://www.haylofriend.com");
        if (origin && url.origin !== origin) return fallback;
        return url.pathname + (url.search || "") + (url.hash || "");
      } catch (_) {
        return fallback;
      }
    }
    if (value.charAt(0) !== "/") return fallback;
    return value;
  }

  function currentOrigin() {
    try {
      if (typeof location !== "undefined" && location.origin) return location.origin;
    } catch (_) {}
    return "https://www.haylofriend.com";
  }

  function normalizeRedirect(raw, fallbackPath) {
    var fallback = fallbackPath || DEFAULT_REDIRECT;
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

  function preferredRedirect() {
    var candidate = "";

    if (typeof window.HF_GET_STARTED_REDIRECT === "string") {
      candidate = window.HF_GET_STARTED_REDIRECT.trim();
    }

    if (!candidate && typeof window.__HF_DEFAULT_REDIRECT_PATH === "string") {
      candidate = window.__HF_DEFAULT_REDIRECT_PATH.trim();
    }

    if (!candidate && typeof window.HF_DASHBOARD_URL === "string") {
      candidate = window.HF_DASHBOARD_URL.trim();
    }

    return normalizeRedirect(candidate || DEFAULT_REDIRECT, DEFAULT_REDIRECT);
  }

  var loginPath = canonicalLoginPath(window.LOGIN_PATH);

  // Optional: full override for Get Started URL
  var envUrl = (typeof window.HF_GET_STARTED_URL === "string" && window.HF_GET_STARTED_URL.trim())
    ? window.HF_GET_STARTED_URL.trim()
    : "";

  var dash = preferredRedirect();

  function buildLoginUrl(targetPath) {
    var normalized = normalizeRedirect(targetPath || dash, dash);
    try {
      var url = new URL(loginPath, currentOrigin());
      url.searchParams.set("redirect", normalized);
      return url.toString();
    } catch (err) {
      return loginPath + "?redirect=" + encodeURIComponent(normalized);
    }
  }

  var redirectTarget = dash;
  var href = envUrl || buildLoginUrl(redirectTarget);

  document.querySelectorAll("[data-get-started]").forEach(function (el) {
    if (el && typeof el.setAttribute === "function") {
      el.setAttribute("href", href);
    }
  });
})();
