import { supabaseBrowser } from './supabaseBrowserClient';

export type AuthedFetchInput = Parameters<typeof fetch>[0];
export type AuthedFetchInit = Parameters<typeof fetch>[1];

export async function authedFetch(
  input: AuthedFetchInput,
  init: AuthedFetchInit = {},
): Promise<Response> {
  let token = '';

  if (supabaseBrowser) {
    const { data } = await supabaseBrowser.auth.getSession();
    token = data?.session?.access_token || '';
  }

  const headers = new Headers(init.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(input, {
    ...init,
    headers,
  });
}

export default authedFetch;
