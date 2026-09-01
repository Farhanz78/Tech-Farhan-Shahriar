
import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sxvjfhbkusjnvagydgwy.supabase.co';
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4dmpmaGJrdXNqbnZhZ3lkZ3d5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5ODIxNjAsImV4cCI6MjA4NDU1ODE2MH0.yNCZ_QWvxtt8zijfzL7r_cnRZzEz_duUb2SOTh3nnjk';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    lock: async (_name, _acquireTimeout, fn) => {
      return await fn();
    },
  },
});

