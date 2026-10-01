-- Pastikan kolom kolom_perbaikan dan kolom_permintaan ada di nota_dinas_templates.
-- Migration ini idempotent (IF NOT EXISTS) — aman dijalankan ulang.
-- Diperlukan jika migration 20260929_add_kolom_perbaikan_to_templates.sql
-- dan 20260929_add_kolom_permintaan_to_templates.sql belum sempat dijalankan.

ALTER TABLE nota_dinas_templates
  ADD COLUMN IF NOT EXISTS kolom_perbaikan  jsonb DEFAULT NULL;

ALTER TABLE nota_dinas_templates
  ADD COLUMN IF NOT EXISTS kolom_permintaan jsonb DEFAULT NULL;
