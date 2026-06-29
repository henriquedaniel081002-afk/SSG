import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const SUPABASE_STORAGE_BUCKET =
  (import.meta.env.VITE_SUPABASE_STORAGE_BUCKET as string | undefined) || 'garantias-fotos';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(
  supabaseUrl || 'https://supabase-url-nao-configurada.supabase.co',
  supabaseAnonKey || 'supabase-anon-key-nao-configurada'
);

export function assertSupabaseConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase não configurado. Crie um arquivo .env com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.'
    );
  }
}
