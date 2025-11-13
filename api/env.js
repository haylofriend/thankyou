export const config = {
  runtime: "edge"
};

export default async function handler(req) {
  const cfg = {
    // Core Supabase project (for auth + data)
    SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      "",
    SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      "",

    // Optional: Google client ID for One Tap / OAuth UI
    GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "",

    // Marketing / get-started link overrides
    HF_GET_STARTED_URL:       process.env.NEXT_PUBLIC_HF_GET_STARTED_URL       || "",
    HF_GET_STARTED_REDIRECT:  process.env.NEXT_PUBLIC_HF_GET_STARTED_REDIRECT  || "/your-impact",

    // 🔑 Canonical login path on your domain
    // Everything should go through this (HayloAuth.login / gate / admin-guard / /login forwarder).
    LOGIN_PATH: process.env.NEXT_PUBLIC_LOGIN_PATH || "/auth/google",

    // Where to send users after auth if nothing else is specified
    HF_DASHBOARD_URL: process.env.NEXT_PUBLIC_HF_DASHBOARD_URL || "/your-impact",

    // Thank-you link host + backend API
    THANK_HOST:  process.env.NEXT_PUBLIC_THANK_HOST  || "https://grateful.haylofriend.com",
    BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || ""
  };

  const js = `(() => { try {
    // Raw config snapshot
    window.__ENV__ = ${JSON.stringify(cfg)};

    // Only set globals if they aren't already set (so pages can override for testing)
    window.SUPABASE_URL            = window.SUPABASE_URL            || window.__ENV__.SUPABASE_URL;
    window.SUPABASE_ANON_KEY       = window.SUPABASE_ANON_KEY       || window.__ENV__.SUPABASE_ANON_KEY;
    window.HF_GET_STARTED_URL      = window.HF_GET_STARTED_URL      || window.__ENV__.HF_GET_STARTED_URL;
    window.HF_GET_STARTED_REDIRECT = window.HF_GET_STARTED_REDIRECT || window.__ENV__.HF_GET_STARTED_REDIRECT;
    window.LOGIN_PATH              = window.LOGIN_PATH              || window.__ENV__.LOGIN_PATH;
    window.HF_DASHBOARD_URL        = window.HF_DASHBOARD_URL        || window.__ENV__.HF_DASHBOARD_URL;
    window.THANK_HOST              = window.THANK_HOST              || window.__ENV__.THANK_HOST;
    window.BACKEND_URL             = window.BACKEND_URL             || window.__ENV__.BACKEND_URL;
    window.GOOGLE_CLIENT_ID        = window.GOOGLE_CLIENT_ID        || window.__ENV__.GOOGLE_CLIENT_ID;
  } catch (e) {
    console.error('env.js apply failed', e);
  } })();`;

  return new Response(js, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
