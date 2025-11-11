export const runtime = 'edge';

export default function handler() {
  // Gather env (read from NEXT_PUBLIC_* in Vercel)
  const cfg = {
    SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
    SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '',
    GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
    HF_DASHBOARD_URL: process.env.NEXT_PUBLIC_HF_DASHBOARD_URL || '/your-impact',
    THANK_HOST:
      process.env.NEXT_PUBLIC_THANK_HOST || 'https://grateful.haylofriend.com'
  };

  const js = `(() => { try {
    window.__ENV__ = ${JSON.stringify(cfg)};
    for (const k in window.__ENV__) { if (!window[k]) window[k] = window.__ENV__[k]; }
  } catch(e){ console.error('env.js', e); } })();`;

  return new Response(js, {
    status: 200,
    headers: {
      'content-type': 'application/javascript; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}
