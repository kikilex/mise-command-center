-- Phase 1: Spaces Architecture Migration
-- Date: 2026-02-03
-- Description: Rebuild Command Center around Spaces, User Profiles, and Unified Permissions.

BEGIN;

-- =============================================================================
-- 1. USERS TABLE EXTENSION
-- =============================================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS user_type VARCHAR(20) DEFAULT 'human';
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_agent BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'America/New_York';
ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS status_message TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS birthday DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Sync display_name with existing name
UPDATE users SET display_name = name WHERE display_name IS NULL;
-- Set Alex as admin based on email from previous migration logic
UPDATE users SET is_admin = true WHERE email = 'lexmillc@gmail.com';

-- =============================================================================
-- 2. SPACES & SPACE MEMBERS
-- =============================================================================

CREATE TABLE IF NOT EXISTS spaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  icon VARCHAR(50), 
  color VARCHAR(20),
  created_by UUID REFERENCES users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  archived_at TIMESTAMP WITH TIME ZONE,
  is_default BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_spaces_created_by ON spaces(created_by);

CREATE TABLE IF NOT EXISTS space_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID REFERENCES spaces(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'viewer',
  invited_by UUID REFERENCES users(id),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(space_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_space_members_space ON space_members(space_id);
CREATE INDEX IF NOT EXISTS idx_space_members_user ON space_members(user_id);

-- =============================================================================
-- 3. LINK ITEMS TO SPACES
-- =============================================================================

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS space_id UUID REFERENCES spaces(id);
CREATE INDEX IF NOT EXISTS idx_tasks_space ON tasks(space_id);

ALTER TABLE projects ADD COLUMN IF NOT EXISTS space_id UUID REFERENCES spaces(id);
CREATE INDEX IF NOT EXISTS idx_projects_space ON projects(space_id);

ALTER TABLE content_items ADD COLUMN IF NOT EXISTS space_id UUID REFERENCES spaces(id);
CREATE INDEX IF NOT EXISTS idx_content_items_space ON content_items(space_id);

ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS space_id UUID REFERENCES spaces(id);

-- Add space_id to existing documents table (table already exists from earlier migrations)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS space_id UUID REFERENCES spaces(id);
CREATE INDEX IF NOT EXISTS idx_documents_space ON documents(space_id);

-- Migrate existing documents to spaces (using business_id if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'business_id') THEN
    UPDATE documents SET space_id = business_id WHERE space_id IS NULL AND business_id IS NOT NULL;
  END IF;
END $$;

-- =============================================================================
-- 4. INITIAL DATA MIGRATION
-- =============================================================================

-- Migrate businesses to spaces
INSERT INTO spaces (id, name, description, color, created_by, created_at)
SELECT id, name, description, color, owner_id, created_at
FROM businesses
ON CONFLICT (id) DO NOTHING;

-- Migrate business members
INSERT INTO space_members (space_id, user_id, role, joined_at)
SELECT business_id, user_id, role, created_at
FROM business_members
ON CONFLICT (space_id, user_id) DO NOTHING;

-- Link existing items to spaces
UPDATE tasks SET space_id = business_id WHERE space_id IS NULL;
UPDATE projects SET space_id = business_id WHERE space_id IS NULL;
UPDATE content_items SET space_id = business_id WHERE space_id IS NULL;
UPDATE ai_agents SET space_id = business_id WHERE space_id IS NULL;

-- Create "Personal" space for users who don't have one
-- Note: We generate a new UUID for each personal space
INSERT INTO spaces (name, description, created_by, is_default)
SELECT 'Personal', 'Your personal space', id, true
FROM users u
WHERE NOT EXISTS (SELECT 1 FROM spaces s WHERE s.created_by = u.id AND s.is_default = true);

-- Add owners to their personal spaces
INSERT INTO space_members (space_id, user_id, role)
SELECT id, created_by, 'owner'
FROM spaces
WHERE is_default = true
ON CONFLICT (space_id, user_id) DO NOTHING;

-- =============================================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Enable RLS
ALTER TABLE spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE space_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Profiles RLS
DROP POLICY IF EXISTS "Users can view all users" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;

CREATE POLICY "Profiles are viewable by authenticated users"
ON users FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Users can update own profile"
ON users FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
  (is_admin = (SELECT is_admin FROM users WHERE id = auth.uid()))
  OR 
  (SELECT is_admin FROM users WHERE id = auth.uid())
);

CREATE POLICY "Admins can update any profile"
ON users FOR UPDATE
USING (
  (SELECT is_admin FROM users WHERE id = auth.uid())
);

-- Spaces RLS
CREATE POLICY "Users can view spaces they belong to"
ON spaces FOR SELECT
USING (
  id IN (SELECT space_id FROM space_members WHERE user_id = auth.uid())
);

CREATE POLICY "Owners can update spaces"
ON spaces FOR UPDATE
USING (
  id IN (SELECT space_id FROM space_members WHERE user_id = auth.uid() AND role = 'owner')
);

CREATE POLICY "Users can create spaces"
ON spaces FOR INSERT
WITH CHECK (auth.uid() = created_by);

-- Tasks RLS (Updated)
DROP POLICY IF EXISTS "Users can view accessible tasks" ON tasks;
CREATE POLICY "Users can view tasks in their spaces"
ON tasks FOR SELECT
USING (
  space_id IN (SELECT space_id FROM space_members WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Users can create tasks" ON tasks;
CREATE POLICY "Editors can create tasks"
ON tasks FOR INSERT
WITH CHECK (
  space_id IN (SELECT space_id FROM space_members WHERE user_id = auth.uid() AND role IN ('editor', 'admin', 'owner'))
);

-- =============================================================================
-- 6. SEED AI AGENTS (as Users)
-- =============================================================================

-- Create user entries for AI agents if they don't exist
-- We use deterministic UUIDs for agents to keep them consistent across environments
INSERT INTO users (id, email, name, display_name, user_type, is_agent, bio)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'ax@mise.family', 'Ax', 'Ax', 'ai_agent', true, 'AI family member. Building the empire with Dad.'),
  ('00000000-0000-0000-0000-000000000002', 'tony@mise.family', 'Tony', 'Tony', 'ai_agent', true, 'The Boss. Handling the muscle, the hustle, and the money.')
ON CONFLICT (email) DO UPDATE SET
  user_type = 'ai_agent',
  is_agent = true,
  bio = EXCLUDED.bio;

COMMIT;
