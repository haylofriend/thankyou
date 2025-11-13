// admin-guard.js
//
// Ensures only admins access this page.
// If the user is not logged in OR not an admin,
// they are redirected through the ONE canonical login path.
//
// Canonical login path = window.LOGIN_PATH || "/auth/google"

(function () {
  var DEFAULT_REDIRECT = "/your-impact";

  function sanitizeRedirect(raw, fallback) {
    var safeFallback = (typeof fallback === "string" && fallback.trim()) ? fallback.trim() : DEFAULT_REDIRECT;
    var candidate = (typeof raw === "string") ? raw.trim() : "";
    if (!candidate) return safeFallback;

    if (candidate.startsWith("http://") || candidate.startsWith("https://")) {
      try {
        var origin = typeof location !== "undefined" && location.origin ? location.origin : "";
        var url = new URL(candidate, origin || "https://www.haylofriend.com");
        if (origin && url.origin !== origin) return safeFallback;
        return url.pathname + (url.search || "") + (url.hash || "");
      } catch (_) {
        return safeFallback;
      }
    }

    if (candidate.charAt(0) !== "/") return safeFallback;
    return candidate;
  }

  function defaultRedirectPath() {
    if (typeof window.HF_GET_STARTED_REDIRECT === "string") {
      var override = sanitizeRedirect(window.HF_GET_STARTED_REDIRECT, DEFAULT_REDIRECT);
      if (override) return override;
    }

    if (typeof window.HF_DASHBOARD_URL === "string") {
      var legacy = sanitizeRedirect(window.HF_DASHBOARD_URL, DEFAULT_REDIRECT);
      if (legacy) return legacy;
    }

    if (typeof window.__HF_DEFAULT_REDIRECT_PATH === "string" && window.__HF_DEFAULT_REDIRECT_PATH) {
      return sanitizeRedirect(window.__HF_DEFAULT_REDIRECT_PATH, DEFAULT_REDIRECT);
    }

    return DEFAULT_REDIRECT;
  }

  /**
   * Safely extracts a same-origin redirect target.
   * Prevents open-redirect vulnerabilities.
   */
  function safeRedirectTarget(defaultPath) {
    try {
      var params = new URLSearchParams(location.search);
      var raw = params.get("redirect") || "";

      if (!raw) return defaultPath;

      var url = new URL(raw, location.origin);
      if (url.origin !== location.origin) return defaultPath;

      return url.pathname + (url.search || "") + (url.hash || "");
    } catch (err) {
      return defaultPath;
    }
  }

  /**
   * Redirects to the canonical login path.
   */
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

  function sendToLogin(target) {
    var login = canonicalLoginPath(window.LOGIN_PATH);
    try {
      var origin = typeof location !== "undefined" && location.origin ? location.origin : "";
      if (origin) {
        var url = new URL(login, origin);
        url.searchParams.set("redirect", target);
        location.replace(url.toString());
        return;
      }
    } catch (_) {}
    location.replace(login + "?redirect=" + encodeURIComponent(target));
  }

  /**
   * Runs the admin enforcement logic.
   */
  async function enforceAdmin() {
    // Get dashboard fallback from env, or use the default.
    var fallbackTarget = defaultRedirectPath();
    var redirectTarget = safeRedirectTarget(fallbackTarget);

    // If HayloAuth is not loaded yet, redirect through login.
    if (!window.HayloAuth || typeof window.HayloAuth.getUser !== "function") {
      sendToLogin(redirectTarget);
      return;
    }

    try {
      // Query current user session
      var user = await window.HayloAuth.getUser();

      // No user? → Login
      if (!user) {
        sendToLogin(redirectTarget);
        return;
      }

      // Expect an admin marker (role, custom claim, or metadata)
      var role = user.role || user.app_role || user.user_role || (user.user_metadata && user.user_metadata.role);

      // Not admin? → No access
      if (role !== "admin") {
        // Could send to dashboard or logout → here we send to dashboard
        location.replace(fallbackTarget);
        return;
      }

      // Admin confirmed → allow page to load
      console.log("ADMIN GUARD: Access granted.");

    } catch (err) {
      console.error("ADMIN GUARD ERROR:", err);
      sendToLogin(redirectTarget);
    }
  }

  // Execute guard on load
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", enforceAdmin, { once: true });
  } else {
    enforceAdmin();
  }

})();
