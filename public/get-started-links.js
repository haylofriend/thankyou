// /public/get-started-links.js

(function () {
  var ENV_PROMISE = null;

  function ensureEnvLoaded() {
    if (ENV_PROMISE) return ENV_PROMISE;

    ENV_PROMISE = new Promise(function (resolve) {
      // If env already applied, resolve immediately
      if (
        (typeof window !== "undefined" &&
          (window.__ENV__ || window.HF_LOGIN_PATH || window.HF_GET_STARTED_REDIRECT)) ||
        typeof document === "undefined"
      ) {
        return resolve();
      }

      var existing = document.querySelector("script[data-haylo-env]");
      if (existing) {
        existing.addEventListener(
          "load",
          function () {
            resolve();
          },
          { once: true }
        );
        existing.addEventListener(
          "error",
          function () {
            resolve();
          },
          { once: true }
        );
        return;
      }

      var s = document.createElement("script");
      s.src = "/env.js";
      s.async = true;
      s.dataset.hayloEnv = "true";
      s.addEventListener(
        "load",
        function () {
          resolve();
        },
        { once: true }
      );
      s.addEventListener(
        "error",
        function () {
          resolve();
        },
        { once: true }
      );
      document.head.appendChild(s);
    });

    return ENV_PROMISE;
  }

  function wireGetStartedLinks() {
    const links = document.querySelectorAll('[data-get-started]');
    if (!links.length) return;

    links.forEach((el) => {
      // canonical target, in this priority order:
      const CANON_GET_STARTED =
        (el.dataset.redirect && el.dataset.redirect.trim()) ||
        (window.HF_GET_STARTED_URL && String(window.HF_GET_STARTED_URL).trim()) ||
        '/create?autostart=1';

      // apply to the link
      el.setAttribute('href', CANON_GET_STARTED);

      // ensure click always honors our canonical path
      el.addEventListener('click', (e) => {
        // allow ctrl/cmd click to open new tab
        if (e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        location.href = CANON_GET_STARTED;
      });
    });
  }

  function init() {
    ensureEnvLoaded().then(wireGetStartedLinks);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
