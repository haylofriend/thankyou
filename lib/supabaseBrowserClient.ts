// lib/supabaseBrowserClient.ts
//
// Shared browser Supabase client.
//
// It prefers NEXT_PUBLIC_* env vars (for modern builds),
// but falls back to window globals set by env.js for the
// older static pages.

import { createClient } from '@supabase/supabase-js';

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
    ? ((window as any).SUPABASE_URL as string | undefined)
    : undefined;

const anonKeyFromWindow =
  typeof window !== 'undefined'
    ? ((window as any).SUPABASE_ANON_KEY as string | undefined)
    : undefined;

const supabaseUrl = urlFromEnv || urlFromWindow;
const supabaseAnonKey = anonKeyFromEnv || anonKeyFromWindow;

if (!supabaseUrl || !supabaseAnonKey) {
  // Shows up in browser console if config is missing.
  console.warn(
    '[supabaseBrowserClient] Missing SUPABASE_URL or SUPABASE_ANON_KEY',
  );
}

export const supabaseBrowser =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;
