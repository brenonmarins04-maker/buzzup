import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Use proxy to bypass DNS issues — Vite proxies in dev, Vercel rewrites in prod
const SUPABASE_URL = typeof window !== 'undefined'
  ? window.location.origin + '/sb-proxy'
  : import.meta.env.VITE_SUPABASE_URL;

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});