export default function handler(req, res) {
  try {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');

    const cfg = {
      // Supabase creds (must be set in Vercel env)
      SUPABASE_URL:        process.env.NEXT_PUBLIC_SUPABASE_URL      || process.env.SUPABASE_URL || '',
      SUPABASE_ANON_KEY:   process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '',

      // 🔒 Kill Google One Tap everywhere (avoid "Can't continue with google.com")
      GOOGLE_CLIENT_ID:    '',

      // Canonical routes (CTA, fallback login, dashboard)
      HF_GET_STARTED_URL:  process.env.NEXT_PUBLIC_HF_GET_STARTED_URL || '/auth/google?redirect=/your-impact',
      // Canonical login entry routes straight to Google auth (no intermediate UI)
      LOGIN_PATH:          process.env.NEXT_PUBLIC_LOGIN_PATH         || '/auth/google',
      HF_DASHBOARD_URL:    process.env.NEXT_PUBLIC_HF_DASHBOARD_URL   || '/your-impact',

      // Preferred marketing domain
      CANONICAL_ORIGIN:    process.env.NEXT_PUBLIC_CANONICAL_ORIGIN   || 'https://www.haylofriend.com',

      // Public host for share links
      THANK_HOST:          process.env.NEXT_PUBLIC_THANK_HOST || 'https://grateful.haylofriend.com'
    };

    const js = `(() => { try {
      // Export config
      window.__ENV__ = ${JSON.stringify(cfg)};

      // 🔐 Force the three nav constants every time
      window.HF_GET_STARTED_URL = window.__ENV__.HF_GET_STARTED_URL; // CTA → /auth/google?redirect=/your-impact
      window.LOGIN_PATH         = window.__ENV__.LOGIN_PATH;         // Dashboard overlay → /auth/google
      window.HF_DASHBOARD_URL   = window.__ENV__.HF_DASHBOARD_URL;   // Post-login → /your-impact

      // Supply creds if missing
      if (!window.SUPABASE_URL)      window.SUPABASE_URL      = window.__ENV__.SUPABASE_URL;
      if (!window.SUPABASE_ANON_KEY) window.SUPABASE_ANON_KEY = window.__ENV__.SUPABASE_ANON_KEY;
      if (!window.THANK_HOST)        window.THANK_HOST        = window.__ENV__.THANK_HOST;
      // Keep GOOGLE_CLIENT_ID empty to prevent GIS init
      window.GOOGLE_CLIENT_ID = '';

      // Enforce canonical host (www) for production visitors
      const canonical = window.__ENV__.CANONICAL_ORIGIN;
      if (canonical && typeof window.location !== 'undefined') {
        try {
          const canonicalUrl = new URL(canonical);
          const bareHost = canonicalUrl.hostname.replace(/^www\./, '');
          const currentHost = window.location.hostname;
          const isLocal = /^(localhost|127\.0\.0\.1)$/i.test(currentHost);

          if (!isLocal && currentHost === bareHost && canonicalUrl.hostname !== bareHost) {
            const suffix = window.location.pathname + window.location.search + window.location.hash;
            const target = canonicalUrl.origin.replace(/\/$/, '') + suffix;
            window.location.replace(target);
            return;
          }

          const onCanonicalFamily = currentHost === canonicalUrl.hostname || currentHost === bareHost;
          if (onCanonicalFamily) {
            const ctaBase = canonicalUrl.origin.replace(/\/$/, '');
            const defaultCta = '/auth/google?redirect=/your-impact';
            if (!window.__ENV__.HF_GET_STARTED_URL || window.__ENV__.HF_GET_STARTED_URL === defaultCta) {
              const canonicalCta = ctaBase + '/auth/google?redirect=' + encodeURIComponent('/your-impact');
              window.__ENV__.HF_GET_STARTED_URL = canonicalCta;
              window.HF_GET_STARTED_URL = canonicalCta;
            }
          }
        } catch (canonErr) {
          console.error('Canonical enforcement failed', canonErr);
        }
      }
    } catch(e){ console.error('env.js apply failed', e); } })();`;

    res.status(200).send(js);
  } catch (e) {
    res.status(200).send(`console.error('env.js failed', ${JSON.stringify(String(e))});`);
  }
}
