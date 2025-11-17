// /public/haylo-redirect.js
// One shared redirect brain for the whole app.

(function (g) {
  var W = (typeof window !== "undefined") ? window : {};
  var ORIGIN_FALLBACK = "https://www.haylofriend.com";

  function currentOrigin() {
    try {
      if (typeof location !== "undefined" && location.origin) {
        return location.origin;
      }
    } catch (_) {}
    return ORIGIN_FALLBACK;
  }

  function baseAllowedPaths() {
    // Core app routes we trust for post-auth redirects
    return [
      "/",
      "/your-impact",
      "/mission-control",
      "/get-started",
      "/bloom",
      "/source",
      "/auth/google"
    ];
  }

  function allowedPaths() {
    var base = baseAllowedPaths();
    // Optional: let the app extend the whitelist safely via window.HF_EXTRA_SAFE_PATHS
    try {
      var extras = W.HF_EXTRA_SAFE_PATHS;
      if (Array.isArray(extras)) {
        extras.forEach(function (p) {
          if (typeof p === "string" && p.charAt(0) === "/") {
            base.push(p);
          }
        });
      }
    } catch (_) {}
    return base;
  }

  function isAllowedPath(pathname) {
    var list = allowedPaths();
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      if (pathname === p || pathname.indexOf(p + "/") === 0) return true;
    }
    return false;
  }

  /**
   * normalize(raw, fallbackPath) → "/safe/path?x=1#y"
   * - Forces same-origin
   * - Enforces whitelist
   * - Returns a *relative* path (no scheme/host)
   */
  function normalize(raw, fallbackPath) {
    var fallback = fallbackPath || "/your-impact";
    if (!raw || typeof raw !== "string") return fallback;

    var base = currentOrigin();
    try {
      var u = new URL(raw, base);

      // 1) Same-origin only
      if (u.origin !== base) return fallback;

      // 2) Whitelisted paths only
      if (!isAllowedPath(u.pathname)) return fallback;

      return u.pathname + (u.search || "") + (u.hash || "");
    } catch (_) {
      return fallback;
    }
  }

  /**
   * abs(raw, fallbackPath) → "https://origin/safe/path?x=1#y"
   * Uses normalize() then attaches the current origin.
   */
  function abs(raw, fallbackPath) {
    var rel = normalize(raw, fallbackPath);
    var base = currentOrigin();
    try {
      return new URL(rel, base).toString();
    } catch (_) {
      // Very conservative fallback
      if (rel.charAt(0) !== "/") rel = "/" + rel;
      return base + rel;
    }
  }

  g.HayloRedirect = {
    normalize: normalize,
    abs: abs,
    isAllowedPath: isAllowedPath,
    currentOrigin: currentOrigin
  };
})(window);
