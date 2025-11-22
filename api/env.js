export const config = {
  runtime: "edge"
};

export default async function handler(req) {
  const requestOrigin = (() => {
    try {
      return new URL(req?.url || "https://www.haylofriend.com").origin;
    } catch (_) {
      return "https://www.haylofriend.com";
    }
  })();

  function canonicalLoginPath(raw) {
    const fallback = "/auth/google/";
    if (!raw || typeof raw !== "string") return fallback;
    const value = raw.trim();
    if (!value) return fallback;
    if (value.startsWith("http://") || value.startsWith("https://")) {
      try {
        const url = new URL(value, requestOrigin);
        if (url.origin !== requestOrigin) return fallback;
        const search = url.search || "";
        const hash = url.hash || "";
        return `${url.pathname}${search}${hash}`;
      } catch (_) {
        return fallback;
      }
    }
    if (value.startsWith("/")) return value;
    return fallback;
  }

  function normalizeGetStartedUrl(raw, fallback) {
    if (!raw || typeof raw !== "string") return fallback;
    const value = raw.trim();
    if (!value) return fallback;
    return value;
  }

  const loginPath = canonicalLoginPath(process.env.NEXT_PUBLIC_LOGIN_PATH);

  const cfg = {
    SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      "",
    SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      "",
    GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "",
    HF_LOGIN_PATH: loginPath,
    HF_GET_STARTED_URL: normalizeGetStartedUrl(
      process.env.NEXT_PUBLIC_HF_GET_STARTED_URL,
      loginPath
    ),
    HF_GET_STARTED_REDIRECT:
      process.env.NEXT_PUBLIC_HF_GET_STARTED_REDIRECT || "/your-impact",
    LOGIN_PATH: loginPath,
    HF_DASHBOARD_URL:
      process.env.NEXT_PUBLIC_HF_DASHBOARD_URL || "/your-impact",
    THANK_HOST:
      process.env.NEXT_PUBLIC_THANK_HOST ||
      "https://grateful.haylofriend.com",
    BACKEND_URL:
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      process.env.BACKEND_URL ||
      "",

    // 🔽 NEW: Stripe public config for frontend
    STRIPE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "",
    STRIPE_CONNECT_CLIENT_ID:
      process.env.NEXT_PUBLIC_STRIPE_CONNECT_CLIENT_ID || "",
    STRIPE_PRO_PRODUCT_ID:
      process.env.NEXT_PUBLIC_STRIPE_PRO_PRODUCT_ID || "",
    STRIPE_PRO_MONTHLY_PRICE_ID:
      process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID || ""
  };

  const js = `(() => { try {
    window.__ENV__ = ${JSON.stringify(cfg)};
    window.SUPABASE_URL            = window.SUPABASE_URL            || window.__ENV__.SUPABASE_URL;
    window.SUPABASE_ANON_KEY       = window.SUPABASE_ANON_KEY       || window.__ENV__.SUPABASE_ANON_KEY;
    window.HF_LOGIN_PATH           = window.HF_LOGIN_PATH           || window.__ENV__.HF_LOGIN_PATH || "/auth/google/";
    window.HF_GET_STARTED_REDIRECT = window.HF_GET_STARTED_REDIRECT || window.__ENV__.HF_GET_STARTED_REDIRECT || "/your-impact";
    window.HF_GET_STARTED_URL      = window.HF_GET_STARTED_URL      || window.__ENV__.HF_GET_STARTED_URL || window.HF_LOGIN_PATH;
    window.LOGIN_PATH              = window.LOGIN_PATH              || window.__ENV__.LOGIN_PATH || window.HF_LOGIN_PATH;
    window.HF_DASHBOARD_URL        = window.HF_DASHBOARD_URL        || window.__ENV__.HF_DASHBOARD_URL;
    window.THANK_HOST              = window.THANK_HOST              || window.__ENV__.THANK_HOST;
    window.BACKEND_URL             = window.BACKEND_URL             || window.__ENV__.BACKEND_URL;
    window.GOOGLE_CLIENT_ID        = window.GOOGLE_CLIENT_ID        || window.__ENV__.GOOGLE_CLIENT_ID;
    window.NEXT_PUBLIC_SUPABASE_URL      = window.NEXT_PUBLIC_SUPABASE_URL      || window.__ENV__.SUPABASE_URL;
    window.NEXT_PUBLIC_SUPABASE_ANON_KEY = window.NEXT_PUBLIC_SUPABASE_ANON_KEY || window.__ENV__.SUPABASE_ANON_KEY;

    // 🔽 NEW: Stripe globals (public only)
    window.STRIPE_PUBLISHABLE_KEY        = window.STRIPE_PUBLISHABLE_KEY        || window.__ENV__.STRIPE_PUBLISHABLE_KEY;
    window.STRIPE_CONNECT_CLIENT_ID      = window.STRIPE_CONNECT_CLIENT_ID      || window.__ENV__.STRIPE_CONNECT_CLIENT_ID;
    window.STRIPE_PRO_PRODUCT_ID         = window.STRIPE_PRO_PRODUCT_ID         || window.__ENV__.STRIPE_PRO_PRODUCT_ID;
    window.STRIPE_PRO_MONTHLY_PRICE_ID   = window.STRIPE_PRO_MONTHLY_PRICE_ID   || window.__ENV__.STRIPE_PRO_MONTHLY_PRICE_ID;
  } catch (e) {
    console.error("env.js apply failed", e);
  } })();`;

  return new Response(js, {
    headers: {
      "content-type": "application/javascript; charset=utf-8"
    }
  });
}
