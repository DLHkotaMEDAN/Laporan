import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase credentials tidak ditemukan. ' +
    'Pastikan VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY sudah diisi di file .env.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);