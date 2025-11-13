(function () {
  var dash = window.HF_DASHBOARD_URL || '/your-impact';
  var loginPath = window.LOGIN_PATH || '/login';
  var envUrl = (typeof window.HF_GET_STARTED_URL === 'string' && window.HF_GET_STARTED_URL.trim())
    ? window.HF_GET_STARTED_URL.trim()
    : '';

  function currentOrigin() {
    return (typeof location !== 'undefined' && location.origin)
      ? location.origin
      : 'https://www.haylofriend.com';
  }

  function abs(path) {
    try { return new URL(path, currentOrigin()).toString(); }
    catch (_) {
      return currentOrigin() + (path || '/');
    }
  }

  function fallbackLoginUrl(target) {
    try {
      var loginUrl = new URL(loginPath, currentOrigin());
      loginUrl.searchParams.set('redirect', target);
      return loginUrl.toString();
    } catch (_) {
      return '/auth/google?redirect=' + encodeURIComponent(target);
    }
  }

  function buildAuthorizeUrl(target) {
    if (window.HayloAuth && typeof window.HayloAuth.buildAuthorizeUrl === 'function') {
      try { return window.HayloAuth.buildAuthorizeUrl(target); }
      catch (_) {}
    }

    var supabaseUrl = ((window.NEXT_PUBLIC_SUPABASE_URL || window.SUPABASE_URL || '')).trim().replace(/\/+$/, '');
    if (supabaseUrl) {
      try {
        var authorize = new URL('/auth/v1/authorize', supabaseUrl);
        authorize.searchParams.set('provider', 'google');
        authorize.searchParams.set('redirect_to', abs(target));
        return authorize.toString();
      } catch (_) {}
    }

    return fallbackLoginUrl(target);
  }

  var redirectTarget = dash;
  var href = envUrl || buildAuthorizeUrl(redirectTarget);

  document.querySelectorAll('[data-get-started]').forEach(function (el) {
    if (el && typeof el.setAttribute === 'function') {
      el.setAttribute('href', href);
    }
  });
})();
