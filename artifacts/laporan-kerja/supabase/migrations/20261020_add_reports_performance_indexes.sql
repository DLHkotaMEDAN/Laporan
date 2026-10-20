-- Add performance indexes for reports table to optimize recap queries
-- These indexes will significantly speed up daily, weekly, and monthly recap queries

-- Composite index for date + region + category queries (most common recap filter pattern)
CREATE INDEX IF NOT EXISTS idx_reports_date_region_category
ON reports (date, region_id, category)
WHERE deleted_at IS NULL;

-- Index for region_id filtering
CREATE INDEX IF NOT EXISTS idx_reports_region_id
ON reports (region_id)
WHERE deleted_at IS NULL;

-- Index for category filtering
CREATE INDEX IF NOT EXISTS idx_reports_category
ON reports (category)
WHERE deleted_at IS NULL;

-- Index for date range queries
CREATE INDEX IF NOT EXISTS idx_reports_date
ON reports (date)
WHERE deleted_at IS NULL;

-- Index for deleted_at soft delete filtering
CREATE INDEX IF NOT EXISTS idx_reports_deleted_at
ON reports (deleted_at)
WHERE deleted_at IS NULL;

-- Add similar indexes for work_plans table
CREATE INDEX IF NOT EXISTS idx_work_plans_date_region_category
ON work_plans (date, region_id, category)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_work_plans_region_id
ON work_plans (region_id)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_work_plans_category
ON work_plans (category)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_work_plans_date
ON work_plans (date)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_work_plans_deleted_at
ON work_plans (deleted_at)
WHERE deleted_at IS NULL;

-- Add indexes for fuel_reports table
CREATE INDEX IF NOT EXISTS idx_fuel_reports_date_region
ON fuel_reports (date, region_id)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_fuel_reports_region_id
ON fuel_reports (region_id)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_fuel_reports_date
ON fuel_reports (date)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_fuel_reports_deleted_at
ON fuel_reports (deleted_at)
WHERE deleted_at IS NULL;

-- Add indexes for spj_oli_records table
CREATE INDEX IF NOT EXISTS idx_spj_oli_records_date_region
ON spj_oli_records (date, region_id)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_spj_oli_records_region_id
ON spj_oli_records (region_id)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_spj_oli_records_date
ON spj_oli_records (date)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_spj_oli_records_deleted_at
ON spj_oli_records (deleted_at)
WHERE deleted_at IS NULL;

-- Add indexes for overtime_records table
CREATE INDEX IF NOT EXISTS idx_overtime_records_date_region
ON overtime_records (date, region_id)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_overtime_records_region_id
ON overtime_records (region_id)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_overtime_records_date
ON overtime_records (date)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_overtime_records_deleted_at
ON overtime_records (deleted_at)
WHERE deleted_at IS NULL;

-- Add indexes for nota_dinas_records table
CREATE INDEX IF NOT EXISTS idx_nota_dinas_records_date_region
ON nota_dinas_records (form->>'tanggal', region_id)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_nota_dinas_records_region_id
ON nota_dinas_records (region_id)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_nota_dinas_records_date
ON nota_dinas_records (form->>'tanggal')
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_nota_dinas_records_deleted_at
ON nota_dinas_records (deleted_at)
WHERE deleted_at IS NULL;
