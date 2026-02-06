-- Project-Level Document Permissions
-- Date: 2026-02-06
-- Description: Add project_members table and project-based document visibility

BEGIN;

-- =============================================================================
-- 1. PROJECT MEMBERS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);

-- Enable RLS
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies for project_members
CREATE POLICY "Users can view project members for their projects"
ON project_members FOR SELECT
USING (
  project_id IN (
    SELECT p.id FROM projects p
    WHERE p.space_id IN (SELECT get_user_space_ids(auth.uid()))
  )
);

CREATE POLICY "Project owners/admins can manage members"
ON project_members FOR ALL
USING (
  project_id IN (
    SELECT project_id FROM project_members 
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
);

CREATE POLICY "Space members can join projects"
ON project_members FOR INSERT
WITH CHECK (
  user_id = auth.uid() AND
  project_id IN (
    SELECT p.id FROM projects p
    WHERE p.space_id IN (SELECT get_user_space_ids(auth.uid()))
  )
);

-- =============================================================================
-- 2. ADD PROJECT_ID TO DOCUMENTS
-- =============================================================================
ALTER TABLE documents ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id);

-- =============================================================================
-- 3. HELPER FUNCTION: Get User's Project IDs
-- =============================================================================
CREATE OR REPLACE FUNCTION get_user_project_ids(user_uuid UUID)
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT project_id FROM project_members WHERE user_id = user_uuid;
$$;

-- Convenience function using auth.uid()
CREATE OR REPLACE FUNCTION get_my_project_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT project_id FROM project_members WHERE user_id = auth.uid();
$$;

-- Also create get_my_space_ids for consistency
CREATE OR REPLACE FUNCTION get_my_space_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT space_id FROM space_members WHERE user_id = auth.uid();
$$;

-- =============================================================================
-- 4. UPDATE DOCUMENTS RLS POLICIES
-- =============================================================================
-- Drop old policies
DROP POLICY IF EXISTS "Docs select" ON documents;
DROP POLICY IF EXISTS "Docs insert" ON documents;
DROP POLICY IF EXISTS "Docs update" ON documents;
DROP POLICY IF EXISTS "Docs delete" ON documents;

-- New policy: 
-- - If doc has project_id: only project members can see it
-- - If doc has NO project_id (space-only): all space members can see it
-- - Creators can always see their own docs
CREATE POLICY "Docs select" ON documents FOR SELECT 
USING (
  created_by = auth.uid()
  OR (
    project_id IS NULL 
    AND space_id IN (SELECT get_user_space_ids(auth.uid()))
  )
  OR (
    project_id IS NOT NULL 
    AND project_id IN (SELECT get_user_project_ids(auth.uid()))
  )
);

CREATE POLICY "Docs insert" ON documents FOR INSERT 
WITH CHECK (
  created_by = auth.uid()
  OR space_id IN (SELECT get_user_space_ids(auth.uid()))
);

CREATE POLICY "Docs update" ON documents FOR UPDATE 
USING (
  created_by = auth.uid()
  OR (
    project_id IS NULL 
    AND space_id IN (SELECT get_user_space_ids(auth.uid()))
  )
  OR (
    project_id IS NOT NULL 
    AND project_id IN (SELECT get_user_project_ids(auth.uid()))
  )
);

CREATE POLICY "Docs delete" ON documents FOR DELETE 
USING (
  created_by = auth.uid()
  OR (
    project_id IS NULL 
    AND space_id IN (SELECT get_user_space_ids(auth.uid()))
  )
  OR (
    project_id IS NOT NULL 
    AND project_id IN (
      SELECT pm.project_id FROM project_members pm 
      WHERE pm.user_id = auth.uid() AND pm.role IN ('owner', 'admin')
    )
  )
);

-- =============================================================================
-- 5. SEED INITIAL PROJECT MEMBERS
-- =============================================================================
-- Add existing project creators as owners
INSERT INTO project_members (project_id, user_id, role)
SELECT p.id, p.created_by, 'owner'
FROM projects p
WHERE p.created_by IS NOT NULL
ON CONFLICT (project_id, user_id) DO NOTHING;

-- Add all space members to existing projects in their spaces (as members)
INSERT INTO project_members (project_id, user_id, role)
SELECT p.id, sm.user_id, 'member'
FROM projects p
JOIN space_members sm ON sm.space_id = p.space_id
WHERE sm.user_id != p.created_by
ON CONFLICT (project_id, user_id) DO NOTHING;

COMMIT;
