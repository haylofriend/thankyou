import { supabaseBrowserClient } from './supabaseBrowserClient';

export type AuthedFetchInput = Parameters<typeof fetch>[0];
export type AuthedFetchInit = Parameters<typeof fetch>[1];

export default async function authedFetch(
  input: AuthedFetchInput,
  init: AuthedFetchInit = {}
): Promise<Response> {
  const supabase = supabaseBrowserClient;

  // If Supabase isn't configured in the browser, just fall back to plain fetch.
  if (!supabase) {
    console.warn('[authedFetch] Supabase client unavailable; sending unauthenticated request');
    return fetch(input, init);
  }

  const { data, error } = await supabase.auth.getSession();

  if (error) {
    console.error('[authedFetch] getSession error', error);
  }

  const token = data?.session?.access_token || '';

  const headers = new Headers(init.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(input, {
    ...init,
    headers,
  });
}
