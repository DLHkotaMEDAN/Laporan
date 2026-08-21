// Seluruh aplikasi harus memakai satu klien Supabase agar sesi dan perubahan
// autentikasi tidak diproses oleh beberapa GoTrueClient sekaligus.
export { supabase } from '@/lib/supabase';
