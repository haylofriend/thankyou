export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  const cfg = {
    SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
    SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '',
    GOOGLE_CLIENT_ID:
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
    HF_DASHBOARD_URL:
      process.env.NEXT_PUBLIC_HF_DASHBOARD_URL || '/your-impact',
    THANK_HOST:
      process.env.NEXT_PUBLIC_THANK_HOST || 'https://grateful.haylofriend.com'
  };
  res.status(200).send(
    `(() => { try {
      window.__ENV__ = ${JSON.stringify(cfg)};
      for (const k in window.__ENV__) { if (!window[k]) window[k] = window.__ENV__[k]; }
    } catch(e){ console.error('env.js', e); } })();`
  );
}
