import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vcgwduccreqwwvljprie.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjZ3dkdWNjcmVxd3d2bGpwcmllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg3Njc4MjEsImV4cCI6MjA2NDM0MzgyMX0.99zmZlIIyh4tpVuFKz-GIN6P78gqVnLN6Be0NXHTEWU';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
}); 