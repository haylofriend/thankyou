// public/get-started-links.js
// Sets all [data-get-started] links to the ONE canonical login path
// LOGIN_PATH (default: /auth/google) + ?redirect=<dashboard>

(function () {
  var DEFAULT_REDIRECT = "/your-impact";

  function currentOrigin() {
    try {
      if (typeof location !== "undefined" && location.origin) return location.origin;
    } catch (_) {}
    return "https://www.haylofriend.com";
  }

  function sanitizeFallback(value) {
    if (typeof value === "string") {
      var trimmed = value.trim();
      if (trimmed.charAt(0) === "/") return trimmed || DEFAULT_REDIRECT;
    }
    return DEFAULT_REDIRECT;
  }

  function canonicalLoginPath(raw) {
    var fallback = "/auth/google";
    if (typeof raw !== "string") return fallback;
    var value = raw.trim();
    if (!value) return fallback;
    if (value.startsWith("http://") || value.startsWith("https://")) {
      try {
        var origin = currentOrigin();
        var url = new URL(value, origin);
        if (url.origin !== origin) return fallback;
        return url.pathname + (url.search || "") + (url.hash || "");
      } catch (_) {
        return fallback;
      }
    }
    if (value.charAt(0) !== "/") return fallback;
    return value;
  }

  function normalizeRedirect(raw, fallbackPath) {
    var fallback = sanitizeFallback(fallbackPath);
    if (typeof raw !== "string") return fallback;
    var value = raw.trim();
    if (!value) return fallback;
    try {
      var base = currentOrigin();
      var u = new URL(value, base);
      if (u.origin !== base) return fallback;
      return u.pathname + (u.search || "") + (u.hash || "");
    } catch (_) {
      return fallback;
    }
  }

  function preferredRedirect() {
    var fallback = DEFAULT_REDIRECT;
    var candidate = "";

    if (typeof window.HF_GET_STARTED_REDIRECT === "string") {
      candidate = window.HF_GET_STARTED_REDIRECT.trim();
    } else if (typeof window.__HF_DEFAULT_REDIRECT_PATH === "string") {
      candidate = window.__HF_DEFAULT_REDIRECT_PATH.trim();
    } else if (typeof window.HF_DASHBOARD_URL === "string") {
      candidate = window.HF_DASHBOARD_URL.trim();
    }

    return normalizeRedirect(candidate || fallback, fallback);
  }

  var loginPath = canonicalLoginPath(window.LOGIN_PATH);
  var dash = preferredRedirect();

  var envUrl = (typeof window.HF_GET_STARTED_URL === "string" && window.HF_GET_STARTED_URL.trim())
    ? window.HF_GET_STARTED_URL.trim()
    : "";

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

  var href = envUrl || buildLoginUrl(dash);

  document.querySelectorAll("[data-get-started]").forEach(function (el) {
    if (el && typeof el.setAttribute === "function") {
      el.setAttribute("href", href);
    }
  });
})();
