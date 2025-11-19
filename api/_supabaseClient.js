// api/_supabaseClient.js
// Provides a shared Supabase client instance for serverless functions.

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase =
  supabaseUrl && supabaseServiceRole
    ? createClient(supabaseUrl, supabaseServiceRole, {
        auth: { persistSession: false }
      })
    : null;

module.exports = {
  supabase
};
