import { NextRequest, NextResponse } from "next/server";

const ADMIN_HOST = "grateful.haylofriend.com";
const ADMIN_PATH = "/mission-control.html";
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "").toLowerCase();

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "";

const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "";

type SupabaseUserResponse = {
  email?: string;
};

async function fetchSupabaseUser(token: string): Promise<SupabaseUserResponse | null> {
  if (!token || !SUPABASE_URL || !SUPABASE_ANON_KEY) return null;

  try {
    const userUrl = `${SUPABASE_URL.replace(/\/+$/, "")}/auth/v1/user`;
    const response = await fetch(userUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      console.warn("Supabase user lookup failed", response.status, response.statusText);
      return null;
    }

    return (await response.json()) as SupabaseUserResponse;
  } catch (error) {
    console.warn("Supabase user lookup threw", error);
    return null;
  }
}

export const config = {
  matcher: ["/mission-control.html"],
};

export default async function middleware(req: NextRequest) {
  const host = req.headers.get("host") || "";
  if (host !== ADMIN_HOST) return NextResponse.next();

  const jwt =
    req.cookies.get("sb-access-token")?.value ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!jwt) {
    const url = new URL("/auth/google", req.url);
    url.searchParams.set("redirect", ADMIN_PATH);
    return NextResponse.redirect(url);
  }

  const supabaseUser = await fetchSupabaseUser(jwt);
  const email = typeof supabaseUser?.email === "string" ? supabaseUser.email.toLowerCase() : null;

  if (email && ADMIN_EMAIL && email === ADMIN_EMAIL) {
    return NextResponse.next();
  }

  if (!ADMIN_EMAIL) {
    console.warn("ADMIN_EMAIL env var is not set; denying access");
  }

  return new NextResponse("Forbidden", { status: 403 });
}
