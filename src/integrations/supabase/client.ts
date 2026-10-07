import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { createSupabaseFetch, supabaseStorageKey } from '@/lib/supabaseTransport';
import { armazenamentoDaSessao } from '@/lib/authStorage';

export const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const isLocalhost = typeof window !== 'undefined'
  && ["localhost", "127.0.0.1"].includes(window.location.hostname);

export const SUPABASE_URL = typeof window !== 'undefined' && !isLocalhost
  ? window.location.origin + '/sb-proxy'
  : import.meta.env.VITE_SUPABASE_URL;

// The production HTTP rewrite rejects WebSocket upgrades. Build the SDK with
// the real project URL and proxy only fetch, not its Realtime connection.
const upstreamUrl = import.meta.env.VITE_SUPABASE_URL;
const chaveDaSessao = supabaseStorageKey(SUPABASE_URL);

export const supabase = createClient<Database>(upstreamUrl, SUPABASE_PUBLISHABLE_KEY, {
  global: { fetch: createSupabaseFetch(upstreamUrl, SUPABASE_URL) },
  auth: {
    // Era `sessionStorage`, que morre junto com a aba — ver src/lib/authStorage.ts.
    storage: armazenamentoDaSessao(chaveDaSessao),
    storageKey: chaveDaSessao,
    persistSession: true,
    autoRefreshToken: true,
  }
});
