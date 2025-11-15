// public/get-started-links.js
// Sets all [data-get-started] links to the ONE login entry point (/login)
// Includes a safe ?redirect= param so the edge handler can send users
// through the canonical provider flow configured in env.js.

(function () {
  // Canonical dashboard (where creators land after signing in)
  var dash = window.HF_DASHBOARD_URL || "/your-impact";

  // Optional: full override for Get Started URL
  var envUrl = (typeof window.HF_GET_STARTED_URL === "string" && window.HF_GET_STARTED_URL.trim())
    ? window.HF_GET_STARTED_URL.trim()
    : "";

  function currentOrigin() {
    try {
      if (typeof location !== "undefined" && location.origin) return location.origin;
    } catch (_) {}
    return "https://www.haylofriend.com";
  }

  function normalizeRedirect(raw, fallbackPath) {
    var fallback = fallbackPath || dash;
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

  function buildLoginUrl(targetPath) {
    var normalized = normalizeRedirect(targetPath || dash, dash);
    try {
      var url = new URL("/login", currentOrigin());
      url.searchParams.set("redirect", normalized);
      return url.toString();
    } catch (err) {
      return "/login?redirect=" + encodeURIComponent(normalized);
    }
  }

  var redirectTarget = normalizeRedirect(
    typeof window.HF_GET_STARTED_REDIRECT === "string"
      ? window.HF_GET_STARTED_REDIRECT
      : undefined,
    dash
  );
  var href = envUrl || buildLoginUrl(redirectTarget);

  document.querySelectorAll("[data-get-started]").forEach(function (el) {
    if (el && typeof el.setAttribute === "function") {
      el.setAttribute("href", href);
    }
  });
})();
