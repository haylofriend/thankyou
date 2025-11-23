// lib/supabaseBrowserClient.ts
//
// Shared Supabase client for use in the browser (React components, etc.).
// It prefers NEXT_PUBLIC_* env vars (modern Next/Vercel), but will also
// fall back to window.__ENV__ populated by /api/env.js for older static pages.

import { createClient, SupabaseClient } from '@supabase/supabase-js';

type WindowWithEnv = Window & {
  __ENV__?: {
    SUPABASE_URL?: string;
    SUPABASE_ANON_KEY?: string;
    NEXT_PUBLIC_SUPABASE_URL?: string;
    NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  };
};

function readEnv(name: string): string | undefined {
  // Prefer process.env when available (Next.js runtime)
  if (typeof process !== 'undefined' && process.env && process.env[name]) {
    return process.env[name] as string;
  }

  // Fallback: window.__ENV__ populated by /api/env.js
  if (typeof window !== 'undefined') {
    const w = window as WindowWithEnv;
    const fromEnv = w.__ENV__ && w.__ENV__[name as keyof NonNullable<WindowWithEnv['__ENV__']>];
    if (fromEnv && typeof fromEnv === 'string') {
      return fromEnv;
    }
  }

  return undefined;
}

const supabaseUrl =
  readEnv('NEXT_PUBLIC_SUPABASE_URL') || readEnv('SUPABASE_URL');
const supabaseAnonKey =
  readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY') || readEnv('SUPABASE_ANON_KEY');

let browserClient: SupabaseClient | null = null;

/**
 * Returns a singleton Supabase browser client, or null if config is missing.
 */
export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey) {
    if (typeof window !== 'undefined') {
      console.warn(
        '[supabaseBrowserClient] Missing Supabase environment variables for browser client'
      );
    }
    return null;
  }

  if (!browserClient) {
    browserClient = createClient(supabaseUrl, supabaseAnonKey);
  }

  return browserClient;
}

export const supabaseBrowserClient = getSupabaseBrowserClient();
export default supabaseBrowserClient;
