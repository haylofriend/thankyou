// api/_supabase-utils.js
// Lightweight Supabase helpers that can be safely shared across API routes.

const { supabase } = require('./_supabaseClient');
const { getUserFromAuthHeader } = require('./utils/getUserFromAuthHeader');

module.exports = {
  supabase,
  getUserFromAuthHeader
};
