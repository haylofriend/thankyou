(function () {
  var getStartedRedirect = window.HF_DASHBOARD_URL || '/your-impact';

  function startGetStartedFlow(event) {
    if (event && typeof event.preventDefault === 'function') {
      event.preventDefault();
    }

    var hayloAuth = window.HayloAuth;
    if (hayloAuth && typeof hayloAuth.login === 'function') {
      try {
        // SINGLE AUTH PATH: always use HayloAuth.login
        hayloAuth.login(getStartedRedirect);
        return false;
      } catch (err) {
        console.warn('HayloAuth login failed', err);
      }
    }

    // Emergency fallback: just go to /your-impact;
    // that page will run the gate and send you to login if needed.
    window.location.href = getStartedRedirect;
    return false;
  }

  function wireGetStarted() {
    var links = document.querySelectorAll('[data-get-started]');
    links.forEach(function (el) {
      if (!el || el.dataset.getStartedWired === 'true' || el.__hayloGetStarted) return;
      el.dataset.getStartedWired = 'true';
      el.__hayloGetStarted = true;
      el.setAttribute('href', '#');
      el.addEventListener('click', startGetStartedFlow);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireGetStarted);
  } else {
    wireGetStarted();
  }

  window.addEventListener('hayloauth:ready', wireGetStarted, { once: true });
})();
