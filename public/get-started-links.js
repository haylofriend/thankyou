(function () {
  // Where the user should land after login:
  var dash = window.HF_DASHBOARD_URL || '/your-impact';

  // Which path should handle login:
  var loginPath = window.LOGIN_PATH || '/login';

  // Optional override from env: HF_GET_STARTED_URL
  var href = window.HF_GET_STARTED_URL ||
    (loginPath + '?redirect=' + encodeURIComponent(dash));

  // Wire every [data-get-started] button to the correct login URL
  document.querySelectorAll('[data-get-started]').forEach(function (el) {
    el.href = href;
  });
})();
