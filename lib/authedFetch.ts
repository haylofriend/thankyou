// lib/authedFetch.ts
//
// Wrapper around fetch that automatically adds the Supabase access token
// from the browser session (if available).

import { supabaseBrowserClient } from './supabaseBrowserClient';

export type AuthedFetchInput = Parameters<typeof fetch>[0];
export type AuthedFetchInit = Parameters<typeof fetch>[1];

async function getAccessToken(): Promise<string | null> {
  if (!supabaseBrowserClient) {
    console.warn(
      '[authedFetch] Supabase browser client unavailable; sending unauthenticated request'
    );
    return null;
  }

  try {
    const { data, error } = await supabaseBrowserClient.auth.getSession();

    if (error) {
      console.error('[authedFetch] getSession error', error);
      return null;
    }

    return data?.session?.access_token ?? null;
  } catch (err) {
    console.error('[authedFetch] Unexpected getSession error', err);
    return null;
  }
}

/**
 * authedFetch behaves like fetch, but:
 * - tries to read the Supabase session in the browser
 * - if it finds a JWT, it adds Authorization: Bearer <token>
 */
export default async function authedFetch(
  input: AuthedFetchInput,
  init: AuthedFetchInit = {}
): Promise<Response> {
  const headers = new Headers((init && init.headers) || {});

  const token = await getAccessToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(input, {
    ...init,
    headers,
  });
}
