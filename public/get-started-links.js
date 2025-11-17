// /public/get-started-links.js

(function () {
  function resolveRedirect(raw) {
    const origin = window.location.origin;
    const fallbackPath = window.HF_GET_STARTED_REDIRECT || '/your-impact';

    let redirectPath = raw || fallbackPath;

    // If it’s a full URL, only allow same-origin; otherwise fall back
    try {
      const url = new URL(redirectPath, origin);
      if (url.origin !== origin) {
        return origin + fallbackPath;
      }
      return url.toString();
    } catch (e) {
      // On any parsing error, just use the fallback
      return origin + fallbackPath;
    }
  }

  function buildLoginHref(redirectUrl) {
    const loginPath = window.HF_LOGIN_PATH || '/auth/google/';
    const url = new URL(loginPath, window.location.origin);
    url.searchParams.set('redirect', redirectUrl);
    return url.pathname + url.search + url.hash; // keep it relative to origin
  }

  function wireGetStartedLinks() {
    const origin = window.location.origin;

    const links = document.querySelectorAll('[data-get-started]');
    if (!links.length) return;

    links.forEach((link) => {
      // optional: allow a custom redirect via data-redirect
      const rawRedirect = link.getAttribute('data-redirect') || null;
      const safeRedirect = resolveRedirect(rawRedirect);
      const href = buildLoginHref(safeRedirect);

      link.setAttribute('href', href);

      // extra safety: enforce redirect on click
      link.addEventListener('click', (event) => {
        event.preventDefault();
        window.location.href = href;
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireGetStartedLinks);
  } else {
    wireGetStartedLinks();
  }
})();
