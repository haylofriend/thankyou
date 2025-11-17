// api/_supabase-utils.js
// Lightweight Supabase helpers that can be safely shared across API routes.

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase =
  supabaseUrl && supabaseServiceRole
    ? createClient(supabaseUrl, supabaseServiceRole, {
        auth: { persistSession: false }
      })
    : null;

function extractAuthHeader(source) {
  if (!source) return '';
  if (typeof source === 'string') return source;

  // Support the standard Node request shape and the Web Fetch API shape.
  const headers =
    source.headers && typeof source.headers === 'object' ? source.headers : null;

  if (headers) {
    if (typeof headers.get === 'function') {
      return headers.get('Authorization') || headers.get('authorization') || '';
    }

    return headers.authorization || headers.Authorization || '';
  }

  if (typeof source.get === 'function') {
    return source.get('Authorization') || source.get('authorization') || '';
  }

  return '';
}

async function getUserFromAuthHeader(source) {
  if (!supabase) return null;

  const header = extractAuthHeader(source);
  if (typeof header !== 'string') return null;

  const normalized = header.trim();
  if (!normalized || !normalized.toLowerCase().startsWith('bearer ')) {
    return null;
  }

  const token = normalized.slice('bearer '.length).trim();
  if (!token) return null;

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;

  return data.user;
}

module.exports = {
  supabase,
  getUserFromAuthHeader
};
