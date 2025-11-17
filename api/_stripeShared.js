// api/_stripeShared.js
// Shared helpers for Stripe + Supabase in Vercel serverless functions (CommonJS style)

const Stripe = require('stripe');
const { supabase, getUserFromAuthHeader } = require('./_supabase-utils');

const stripeSecret = process.env.STRIPE_SECRET_KEY;
if (!stripeSecret) {
  // This only matters once we actually import this file in an API route.
  throw new Error('Missing STRIPE_SECRET_KEY env var');
}

const stripe = new Stripe(stripeSecret, {
  apiVersion: '2022-11-15'
});

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

module.exports = {
  stripe,
  supabase,
  parseBody,
  json,
  getUserFromAuthHeader
};
