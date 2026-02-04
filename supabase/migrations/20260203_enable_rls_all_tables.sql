-- RLS Migration for Mise Command Center
-- Date: 2026-02-03
-- Purpose: Enable Row Level Security on all core tables

-- First, drop existing policies if they exist (for idempotency)

-- spaces policies
DROP POLICY IF EXISTS "Users can view spaces they belong to" ON spaces;
DROP POLICY IF EXISTS "Authenticated users can create spaces" ON spaces;
DROP POLICY IF EXISTS "Space owners/admins can update" ON spaces;
DROP POLICY IF EXISTS "Space owners can delete" ON spaces;

-- space_members policies
DROP POLICY IF EXISTS "Users can view members of their spaces" ON space_members;
DROP POLICY IF EXISTS "Space owners/admins can add members" ON space_members;
DROP POLICY IF EXISTS "Space owners/admins can update member roles" ON space_members;
DROP POLICY IF EXISTS "Space owners/admins can remove members" ON space_members;

-- tasks policies
DROP POLICY IF EXISTS "Users can view tasks in their spaces or assigned to them" ON tasks;
DROP POLICY IF EXISTS "Users can create tasks in their spaces" ON tasks;
DROP POLICY IF EXISTS "Users can update tasks in their spaces" ON tasks;
DROP POLICY IF EXISTS "Users can delete their own tasks or as space admin" ON tasks;

-- documents policies
DROP POLICY IF EXISTS "Users can view docs in their spaces or own docs" ON documents;
DROP POLICY IF EXISTS "Users can create docs in their spaces" ON documents;
DROP POLICY IF EXISTS "Users can update docs in their spaces or own docs" ON documents;
DROP POLICY IF EXISTS "Users can delete own docs or as space admin" ON documents;

-- projects policies
DROP POLICY IF EXISTS "Users can view projects in their spaces" ON projects;
DROP POLICY IF EXISTS "Users can create projects in their spaces" ON projects;
DROP POLICY IF EXISTS "Users can update projects in their spaces" ON projects;
DROP POLICY IF EXISTS "Space owners/admins can delete projects" ON projects;

-- inbox policies
DROP POLICY IF EXISTS "Users can view their own messages" ON inbox;
DROP POLICY IF EXISTS "Users can create messages" ON inbox;
DROP POLICY IF EXISTS "Users can update their own messages" ON inbox;
DROP POLICY IF EXISTS "Users can delete their own messages" ON inbox;

-- notes policies
DROP POLICY IF EXISTS "Users can CRUD their own notes" ON notes;

-- ai_work_log policies
DROP POLICY IF EXISTS "Anyone authenticated can view work log" ON ai_work_log;
DROP POLICY IF EXISTS "Authenticated users can insert" ON ai_work_log;

-- agent_chat policies
DROP POLICY IF EXISTS "Users can view their own agent chats" ON agent_chat;
DROP POLICY IF EXISTS "Users can create agent chat messages" ON agent_chat;

-- users policies
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;

-- Now enable RLS on all tables
ALTER TABLE spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE space_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_work_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_chat ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policies for spaces
CREATE POLICY "Users can view spaces they belong to"
  ON spaces FOR SELECT
  USING (id IN (SELECT space_id FROM space_members WHERE user_id = auth.uid()));

CREATE POLICY "Authenticated users can create spaces"
  ON spaces FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Space owners/admins can update"
  ON spaces FOR UPDATE
  USING (id IN (SELECT space_id FROM space_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));

CREATE POLICY "Space owners can delete"
  ON spaces FOR DELETE
  USING (id IN (SELECT space_id FROM space_members WHERE user_id = auth.uid() AND role = 'owner'));

-- Create policies for space_members
CREATE POLICY "Users can view members of their spaces"
  ON space_members FOR SELECT
  USING (space_id IN (SELECT space_id FROM space_members WHERE user_id = auth.uid()));

CREATE POLICY "Space owners/admins can add members"
  ON space_members FOR INSERT
  WITH CHECK (space_id IN (SELECT space_id FROM space_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));

CREATE POLICY "Space owners/admins can update member roles"
  ON space_members FOR UPDATE
  USING (space_id IN (SELECT space_id FROM space_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));

CREATE POLICY "Space owners/admins can remove members"
  ON space_members FOR DELETE
  USING (space_id IN (SELECT space_id FROM space_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));

-- Create policies for tasks
CREATE POLICY "Users can view tasks in their spaces or assigned to them"
  ON tasks FOR SELECT
  USING (
    space_id IN (SELECT space_id FROM space_members WHERE user_id = auth.uid())
    OR assignee_id = auth.uid()
    OR created_by = auth.uid()
  );

CREATE POLICY "Users can create tasks in their spaces"
  ON tasks FOR INSERT
  WITH CHECK (
    space_id IS NULL
    OR space_id IN (SELECT space_id FROM space_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update tasks in their spaces"
  ON tasks FOR UPDATE
  USING (
    space_id IN (SELECT space_id FROM space_members WHERE user_id = auth.uid())
    OR assignee_id = auth.uid()
    OR created_by = auth.uid()
  );

CREATE POLICY "Users can delete their own tasks or as space admin"
  ON tasks FOR DELETE
  USING (
    created_by = auth.uid()
    OR space_id IN (SELECT space_id FROM space_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
  );

-- Create policies for documents
CREATE POLICY "Users can view docs in their spaces or own docs"
  ON documents FOR SELECT
  USING (
    space_id IN (SELECT space_id FROM space_members WHERE user_id = auth.uid())
    OR created_by = auth.uid()
  );

CREATE POLICY "Users can create docs in their spaces"
  ON documents FOR INSERT
  WITH CHECK (
    space_id IS NULL
    OR space_id IN (SELECT space_id FROM space_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update docs in their spaces or own docs"
  ON documents FOR UPDATE
  USING (
    space_id IN (SELECT space_id FROM space_members WHERE user_id = auth.uid())
    OR created_by = auth.uid()
  );

CREATE POLICY "Users can delete own docs or as space admin"
  ON documents FOR DELETE
  USING (
    created_by = auth.uid()
    OR space_id IN (SELECT space_id FROM space_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
  );

-- Create policies for projects
CREATE POLICY "Users can view projects in their spaces"
  ON projects FOR SELECT
  USING (
    space_id IN (SELECT space_id FROM space_members WHERE user_id = auth.uid())
    OR created_by = auth.uid()
  );

CREATE POLICY "Users can create projects in their spaces"
  ON projects FOR INSERT
  WITH CHECK (
    space_id IS NULL
    OR space_id IN (SELECT space_id FROM space_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update projects in their spaces"
  ON projects FOR UPDATE
  USING (
    space_id IN (SELECT space_id FROM space_members WHERE user_id = auth.uid())
    OR created_by = auth.uid()
  );

CREATE POLICY "Space owners/admins can delete projects"
  ON projects FOR DELETE
  USING (
    created_by = auth.uid()
    OR space_id IN (SELECT space_id FROM space_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
  );

-- Create policies for inbox
CREATE POLICY "Users can view their own messages"
  ON inbox FOR SELECT
  USING (
    user_id = auth.uid()
    OR (space_id IS NOT NULL AND space_id IN (SELECT space_id FROM space_members WHERE user_id = auth.uid()))
  );

CREATE POLICY "Users can create messages"
  ON inbox FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own messages"
  ON inbox FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own messages"
  ON inbox FOR DELETE
  USING (user_id = auth.uid());

-- Create policies for notes
CREATE POLICY "Users can CRUD their own notes"
  ON notes FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Create policies for ai_work_log
CREATE POLICY "Anyone authenticated can view work log"
  ON ai_work_log FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert"
  ON ai_work_log FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Create policies for agent_chat
CREATE POLICY "Users can view their own agent chats"
  ON agent_chat FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create agent chat messages"
  ON agent_chat FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Create policies for users
CREATE POLICY "Profiles are viewable by authenticated users"
  ON users FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (id = auth.uid());

-- Create Mom's Personal Space
INSERT INTO spaces (id, name, created_by, is_default) 
VALUES (gen_random_uuid(), 'Personal', 'ad3e0539-6c9a-4747-9c5a-8a6a8f6353c8', true);

-- Add Mom as owner of her personal space
WITH new_space AS (
  SELECT id FROM spaces 
  WHERE name = 'Personal' 
  AND created_by = 'ad3e0539-6c9a-4747-9c5a-8a6a8f6353c8'
  AND is_default = true
  ORDER BY created_at DESC 
  LIMIT 1
)
INSERT INTO space_members (space_id, user_id, role)
SELECT id, 'ad3e0539-6c9a-4747-9c5a-8a6a8f6353c8', 'owner'
FROM new_space;

-- Verify Mom is already a member of Faithstone
INSERT INTO space_members (space_id, user_id, role)
SELECT 'b5b0d5a5-3968-459f-a747-b74e518cff21', 'ad3e0539-6c9a-4747-9c5a-8a6a8f6353c8', 'member'
WHERE NOT EXISTS (
  SELECT 1 FROM space_members 
  WHERE space_id = 'b5b0d5a5-3968-459f-a747-b74e518cff21' 
  AND user_id = 'ad3e0539-6c9a-4747-9c5a-8a6a8f6353c8'
);