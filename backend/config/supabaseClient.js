const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// We use the service role key (or anon key) depending on RLS setup.
// For backend servers, service_role key is recommended to bypass RLS for secure operations.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('CRITICAL: Missing SUPABASE_URL or SUPABASE_KEY in environment variables.');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false // Disable session persistence in Node.js server context
  }
});

module.exports = supabase;
