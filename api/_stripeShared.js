// api/_stripeShared.js
// Shared helpers for Stripe + Supabase in Vercel serverless functions (CommonJS style)

const Stripe = require('stripe');
const {
  supabase,
  json: baseJson,
  authenticateRequest,
  respondAuthError,
  getUserFromAuthHeader,
} = require('./_supabase-utils');

const stripeSecret = process.env.STRIPE_SECRET_KEY;
if (!stripeSecret) {
  // This only matters once we actually import this file in an API route.
  throw new Error('Missing STRIPE_SECRET_KEY env var');
}

const stripe = new Stripe(stripeSecret, {
  apiVersion: '2022-11-15',
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
  return baseJson(res, status, body);
}

module.exports = {
  stripe,
  supabase,
  parseBody,
  json,
  authenticateRequest,
  respondAuthError,
  getUserFromAuthHeader,
};
