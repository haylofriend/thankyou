// api/_stripeShared.js
// Shared helpers for Stripe + Supabase in Vercel serverless functions (CommonJS style)

const Stripe = require('stripe');
const { supabase, getUserFromAuthHeader } = require('./_supabase-utils');

const stripeSecret = process.env.STRIPE_SECRET_KEY;
let stripeClient = null;

function getStripe() {
  if (stripeClient) return stripeClient;
  if (!stripeSecret) {
    console.warn(
      '[stripeShared] STRIPE_SECRET_KEY env var missing; Stripe client unavailable'
    );
    return null;
  }

  stripeClient = new Stripe(stripeSecret, {
    apiVersion: '2022-11-15'
  });

  return stripeClient;
}

const platformFeeBpsEnv =
  process.env.STRIPE_PLATFORM_FEE_BPS ||
  process.env.PLATFORM_FEE_BPS ||
  process.env.HF_PLATFORM_FEE_BPS;
const platformFeeFlatEnv =
  process.env.STRIPE_PLATFORM_FEE_FLAT_CENTS ||
  process.env.PLATFORM_FEE_FLAT_CENTS ||
  process.env.HF_PLATFORM_FEE_FLAT_CENTS;

const platformFeeBps = Number(platformFeeBpsEnv);
const platformFeeFlatCents = Number(platformFeeFlatEnv);

function calculateApplicationFeeAmount(amountCents) {
  if (!Number.isFinite(amountCents) || amountCents <= 0) return null;

  const percentFee =
    Number.isFinite(platformFeeBps) && platformFeeBps > 0
      ? Math.floor((amountCents * platformFeeBps) / 10000)
      : 0;
  const flatFee =
    Number.isFinite(platformFeeFlatCents) && platformFeeFlatCents > 0
      ? Math.round(platformFeeFlatCents)
      : 0;

  const total = percentFee + flatFee;
  return total > 0 ? total : null;
}

function extractHeader(headers, key) {
  if (!headers) return null;
  if (typeof headers.get === 'function') {
    return headers.get(key) || headers.get(key.toLowerCase());
  }
  const lowerKey = key.toLowerCase();
  return headers[lowerKey] || headers[key] || null;
}

function getRequestId(req) {
  if (!req) return null;
  const headers = req.headers || req.request?.headers;
  if (!headers) return null;

  return (
    extractHeader(headers, 'x-request-id') ||
    extractHeader(headers, 'x-vercel-id') ||
    extractHeader(headers, 'x-amzn-trace-id') ||
    extractHeader(headers, 'x-cloud-trace-context') ||
    null
  );
}

function createLogger(req, defaultMeta = {}) {
  const requestId = getRequestId(req);

  function log(level, message, meta = {}) {
    const payload = {
      level,
      msg: message,
      ...defaultMeta,
      ...meta
    };

    if (requestId && !payload.requestId) {
      payload.requestId = requestId;
    }

    const serialized = JSON.stringify(payload);
    if (level === 'error') {
      console.error(serialized);
    } else if (level === 'warn') {
      console.warn(serialized);
    } else {
      console.log(serialized);
    }
  }

  return {
    info: (message, meta) => log('info', message, meta),
    warn: (message, meta) => log('warn', message, meta),
    error: (message, meta) => log('error', message, meta)
  };
}

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
  getStripe,
  supabase,
  parseBody,
  json,
  getUserFromAuthHeader,
  calculateApplicationFeeAmount,
  createLogger
};
