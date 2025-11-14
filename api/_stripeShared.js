// api/_stripeShared.js
// Shared helpers for Stripe + Supabase in Vercel serverless functions (CommonJS style)

const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

const stripeSecret = process.env.STRIPE_SECRET_KEY;
if (!stripeSecret) {
  // This only matters once we actually import this file in an API route.
  throw new Error('Missing STRIPE_SECRET_KEY env var');
}

const stripe = new Stripe(stripeSecret, {
  apiVersion: '2022-11-15'
});

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase =
  supabaseUrl && supabaseServiceRole
    ? createClient(supabaseUrl, supabaseServiceRole, {
        auth: { persistSession: false }
      })
    : null;

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch (e) {
      return {};
    }
  }
  return req.body || {};
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
}

async function getUserFromAuthHeader(req) {
  if (!supabase) return null;

  const auth = req.headers.authorization || req.headers.Authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;

  const token = auth.slice('Bearer '.length).trim();
  if (!token) return null;

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;

  return data.user;
}

module.exports = {
  stripe,
  supabase,
  parseBody,
  json,
  getUserFromAuthHeader
};
