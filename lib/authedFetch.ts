// lib/authedFetch.ts
//
// Wrapper around fetch that automatically adds the Supabase
// access token (if available) from the browser session.

import { supabaseBrowser } from './supabaseBrowserClient';

export type AuthedFetchInput = Parameters<typeof fetch>[0];
export type AuthedFetchInit = Parameters<typeof fetch>[1];

export async function authedFetch(
  input: AuthedFetchInput,
  init: AuthedFetchInit = {},
): Promise<Response> {
  // If Supabase isn't configured in the browser, just fall back to plain fetch.
  if (!supabaseBrowser) {
    console.warn(
      '[authedFetch] Supabase client unavailable; sending unauthenticated request',
    );
    return fetch(input, init);
  }

  const { data, error } = await supabaseBrowser.auth.getSession();

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
