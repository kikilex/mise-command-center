-- Add notes column to phase_items for item detail drawer
ALTER TABLE phase_items ADD COLUMN IF NOT EXISTS notes TEXT;
