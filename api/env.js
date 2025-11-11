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
      HF_GET_STARTED_URL:  process.env.NEXT_PUBLIC_HF_GET_STARTED_URL || '/create?autostart=1',
      LOGIN_PATH:          process.env.NEXT_PUBLIC_LOGIN_PATH         || '/get-started',
      HF_DASHBOARD_URL:    process.env.NEXT_PUBLIC_HF_DASHBOARD_URL   || '/your-impact',

      // Public host for share links
      THANK_HOST:          process.env.NEXT_PUBLIC_THANK_HOST || 'https://grateful.haylofriend.com'
    };

    const js = `(() => { try {
      // Export config
      window.__ENV__ = ${JSON.stringify(cfg)};

      // 🔐 Force the three nav constants every time
      window.HF_GET_STARTED_URL = window.__ENV__.HF_GET_STARTED_URL; // CTA → /create?autostart=1
      window.LOGIN_PATH         = window.__ENV__.LOGIN_PATH;         // Dashboard overlay → /get-started
      window.HF_DASHBOARD_URL   = window.__ENV__.HF_DASHBOARD_URL;   // Post-login → /your-impact

      // Supply creds if missing
      if (!window.SUPABASE_URL)      window.SUPABASE_URL      = window.__ENV__.SUPABASE_URL;
      if (!window.SUPABASE_ANON_KEY) window.SUPABASE_ANON_KEY = window.__ENV__.SUPABASE_ANON_KEY;
      if (!window.THANK_HOST)        window.THANK_HOST        = window.__ENV__.THANK_HOST;
      // Keep GOOGLE_CLIENT_ID empty to prevent GIS init
      window.GOOGLE_CLIENT_ID = '';
    } catch(e){ console.error('env.js apply failed', e); } })();`;

    res.status(200).send(js);
  } catch (e) {
    res.status(200).send(`console.error('env.js failed', ${JSON.stringify(String(e))});`);
  }
}
