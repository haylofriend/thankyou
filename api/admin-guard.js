// admin-guard.js
//
// Ensures only admins access this page.
// If the user is not logged in OR not an admin,
// they are redirected through the ONE canonical login path.
//
// Canonical login path = window.LOGIN_PATH || "/auth/google"

(function () {
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
  function sendToLogin(target) {
    var login = window.LOGIN_PATH || "/auth/google";
    var url = login + "?redirect=" + encodeURIComponent(target);
    location.replace(url);
  }

  /**
   * Runs the admin enforcement logic.
   */
  async function enforceAdmin() {
    // Get dashboard fallback from env, or use the default.
    var fallbackTarget = (window.HF_DASHBOARD_URL || "/your-impact");
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
      var role = user.role || user.app_role || user.user_role || user?.user_metadata?.role;

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
