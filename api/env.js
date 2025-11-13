export const config = {
  runtime: "edge"
};

export default async function handler(req) {
  const cfg = {
    SUPABASE_URL:        process.env.NEXT_PUBLIC_SUPABASE_URL      || process.env.SUPABASE_URL || "",
    SUPABASE_ANON_KEY:   process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "",
    GOOGLE_CLIENT_ID:    "",
    HF_GET_STARTED_URL:  process.env.NEXT_PUBLIC_HF_GET_STARTED_URL || "",
    LOGIN_PATH:          process.env.NEXT_PUBLIC_LOGIN_PATH         || "/auth/google",
    HF_DASHBOARD_URL:    process.env.NEXT_PUBLIC_HF_DASHBOARD_URL   || "/your-impact",
    THANK_HOST:          process.env.NEXT_PUBLIC_THANK_HOST || "https://grateful.haylofriend.com",
    BACKEND_URL:         process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || ""
  };

  const js = `(() => { try {
    window.__ENV__ = ${JSON.stringify(cfg)};
    window.HF_GET_STARTED_URL = window.__ENV__.HF_GET_STARTED_URL;
    window.LOGIN_PATH         = window.__ENV__.LOGIN_PATH;
    window.HF_DASHBOARD_URL   = window.__ENV__.HF_DASHBOARD_URL;

    if (!window.SUPABASE_URL)      window.SUPABASE_URL      = window.__ENV__.SUPABASE_URL;
    if (!window.SUPABASE_ANON_KEY) window.SUPABASE_ANON_KEY = window.__ENV__.SUPABASE_ANON_KEY;
    if (!window.THANK_HOST)        window.THANK_HOST        = window.__ENV__.THANK_HOST;
    if (!window.BACKEND_URL)       window.BACKEND_URL       = window.__ENV__.BACKEND_URL;

    window.GOOGLE_CLIENT_ID = "";
  } catch(e){ console.error('env.js apply failed', e); } })();`;

  return new Response(js, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
