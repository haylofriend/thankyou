import supabaseBrowserClient from './supabaseBrowserClient';

export type AuthedFetchInput = Parameters<typeof fetch>[0];
export type AuthedFetchInit = Parameters<typeof fetch>[1];

export async function authedFetch(
  input: AuthedFetchInput,
  init: AuthedFetchInit = {}
): Promise<Response> {
  const { data } = await supabaseBrowserClient.auth.getSession();
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

export default authedFetch;
