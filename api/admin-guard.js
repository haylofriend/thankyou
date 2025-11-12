export const config = { runtime: 'edge' };

// helpers
const ADMIN_HOST = 'grateful.haylofriend.com';
const PUBLIC_HOST = 'www.haylofriend.com';
const ADMIN_PATH = '/mission-control.html';               // public URL we guard
const REAL_FILE = '/mission-control (1).html';            // the actual static file we serve when allowed

function getJwt(req) {
  const auth = req.headers.get('authorization');
  if (auth && /^Bearer\s+/i.test(auth)) return auth.replace(/^Bearer\s+/i, '');
  const cookie = req.headers.get('cookie') || '';
  // common Supabase cookies (v2 and older)
  const m =
    cookie.match(/(?:^|;\s*)sb-access-token=([^;]+)/) ||
    cookie.match(/(?:^|;\s*)supabase.auth.token=([^;]+)/) ||
    cookie.match(/(?:^|;\s*)sb:token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function decodeEmail(jwt) {
  try {
    const [, payloadB64] = jwt.split('.');
    const json = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'));
    const obj = JSON.parse(json);
    return (obj.email || '').toLowerCase();
  } catch {
    return '';
  }
}

export default async function handler(req) {
  const url = new URL(req.url);
  const host = (req.headers.get('host') || '').toLowerCase();

  // Only guard on the admin host; if someone hits this on www, bounce to www home.
  if (host !== ADMIN_HOST) {
    return Response.redirect(`https://${PUBLIC_HOST}/`, 302);
  }

  const jwt = getJwt(req);
  if (!jwt) {
    // Not signed in → send to Google on admin host, then come back to /mission-control.html
    const login = new URL(`https://${ADMIN_HOST}/auth/google`);
    login.searchParams.set('redirect', ADMIN_PATH);
    return Response.redirect(login.toString(), 302);
  }

  const email = decodeEmail(jwt);
  const allowed = (email && process.env.ADMIN_EMAIL && email === process.env.ADMIN_EMAIL.toLowerCase());
  if (!allowed) {
    // Signed in but not admin → send to public site
    return Response.redirect(`https://${PUBLIC_HOST}/`, 302);
  }

  // Admin OK → fetch and return the real static file
  const assetURL = new URL(REAL_FILE, url);
  // IMPORTANT: REAL_FILE differs from ADMIN_PATH to avoid rewrite loop
  const res = await fetch(assetURL.toString(), {
    headers: { cookie: req.headers.get('cookie') || '' },
  });
  // If the asset is missing, fail closed
  if (!res.ok) return new Response('Not Found', { status: 404 });
  // Pass-through contents and headers
  const hdrs = new Headers(res.headers);
  return new Response(await res.arrayBuffer(), { status: 200, headers: hdrs });
}
