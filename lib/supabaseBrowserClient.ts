import { createClient } from '@supabase/supabase-js';

// Shared browser Supabase client.
//
// It prefers NEXT_PUBLIC_* env vars (for modern builds),
// but falls back to window globals set by env.js for the
// older static pages.

const urlFromEnv =
  typeof process !== 'undefined'
    ? (process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined)
    : undefined;

const anonKeyFromEnv =
  typeof process !== 'undefined'
    ? (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined)
    : undefined;

const urlFromWindow =
  typeof window !== 'undefined'
    ? // @ts-ignore
      (window.SUPABASE_URL as string | undefined)
    : undefined;

const anonKeyFromWindow =
  typeof window !== 'undefined'
    ? // @ts-ignore
      (window.SUPABASE_ANON_KEY as string | undefined)
    : undefined;

const supabaseUrl = urlFromEnv || urlFromWindow;
const supabaseAnonKey = anonKeyFromEnv || anonKeyFromWindow;

if (!supabaseUrl || !supabaseAnonKey) {
  // This will show up in the browser console if config is missing.
  // It should help us debug env.js / NEXT_PUBLIC_ wiring problems.
  console.warn('[supabaseBrowserClient] Missing SUPABASE_URL or SUPABASE_ANON_KEY');
}

export const supabaseBrowser = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
