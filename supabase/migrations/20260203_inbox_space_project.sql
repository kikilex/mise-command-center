-- Add space and project linking to inbox items
ALTER TABLE inbox ADD COLUMN IF NOT EXISTS space_id UUID REFERENCES spaces(id) ON DELETE SET NULL;
ALTER TABLE inbox ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inbox_space ON inbox(space_id) WHERE space_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inbox_project ON inbox(project_id) WHERE project_id IS NOT NULL;
