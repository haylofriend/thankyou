export default function handler(req, res) {
  try {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');

    // Only enable Google One Tap (GIS) on the production host.
    const host = String(req.headers.host || '');
    const isProdHost = host.endsWith('haylofriend.com');

    const cfg = {
      SUPABASE_URL:
        process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
      SUPABASE_ANON_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '',

      // GIS only on production to avoid "Can't continue with google.com" on previews
      GOOGLE_CLIENT_ID: isProdHost ? (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '') : '',

      HF_DASHBOARD_URL: process.env.NEXT_PUBLIC_HF_DASHBOARD_URL || '/your-impact',
      THANK_HOST: process.env.NEXT_PUBLIC_THANK_HOST || 'https://grateful.haylofriend.com',

      // Keep dashboard↔auth handshake explicit
      LOGIN_PATH: process.env.NEXT_PUBLIC_LOGIN_PATH || '/get-started',
    };

    const js = `(() => { try {
      window.__ENV__ = ${JSON.stringify(cfg)};
      for (const k in window.__ENV__) { if (!window[k]) window[k] = window.__ENV__[k]; }
    } catch(e){ console.error('env.js', e); } })();`;

    res.status(200).send(js);
  } catch (e) {
    res.status(200).send(`console.error('env.js failed', ${JSON.stringify(String(e))});`);
  }
}
