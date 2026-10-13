/**
 * Script untuk menjalankan migration database via Supabase client
 * Penggunaan: npx tsx scripts/run-migration.ts
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Ambil credentials dari environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Error: VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY harus diset di environment variables');
  console.error('💡 Pastikan file .env sudah ada dan berisi credentials yang valid');
  process.exit(1);
}

// Buat Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runMigration() {
  console.log('🚀 Memulai migration...\n');

  // Baca file migration
  const migrationPath = join(process.cwd(), 'supabase/migrations/20261013_complete_fix.sql');
  const migrationSQL = readFileSync(migrationPath, 'utf-8');

  // Split SQL statements berdasarkan semicolon
  const statements = migrationSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`📝 Ditemukan ${statements.length} statement SQL untuk dijalankan\n`);

  // Jalankan setiap statement
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    console.log(`[${i + 1}/${statements.length}] Menjalankan: ${statement.substring(0, 50)}...`);

    try {
      const { error } = await supabase.rpc('exec_sql', { sql: statement });

      if (error) {
        console.error(`❌ Error pada statement ${i + 1}:`, error.message);
        console.error('SQL:', statement);
        console.log('\n⚠️  Migration gagal. Silakan coba via Supabase Dashboard SQL Editor.');
        process.exit(1);
      }

      console.log(`✅ Statement ${i + 1} berhasil\n`);
    } catch (err) {
      console.error(`❌ Error pada statement ${i + 1}:`, err);
      console.error('SQL:', statement);
      console.log('\n⚠️  Migration gagal. Silakan coba via Supabase Dashboard SQL Editor.');
      process.exit(1);
    }
  }

  console.log('✨ Migration berhasil diselesaikan!');
  console.log('\n📋 Langkah selanjutnya:');
  console.log('1. Upload gambar ke bucket assets/landing/ via Supabase Dashboard Storage');
  console.log('2. Refresh browser untuk memverifikasi error sudah hilang');
}

runMigration().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
