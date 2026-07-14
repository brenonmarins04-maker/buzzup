import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

export const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const isLocalhost = typeof window !== 'undefined'
  && ["localhost", "127.0.0.1"].includes(window.location.hostname);

// Production uses the Vercel rewrite. Local development uses Supabase directly
// because the Vite proxy can fail on some Windows networks.
export const SUPABASE_URL = typeof window !== 'undefined' && !isLocalhost
  ? window.location.origin + '/sb-proxy'
  : import.meta.env.VITE_SUPABASE_URL;

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: sessionStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
