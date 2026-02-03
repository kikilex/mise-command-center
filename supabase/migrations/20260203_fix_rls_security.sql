-- Fix RLS Security and recursion issues
-- Date: 2026-02-03
-- Phase 1 of Fixes Spec

BEGIN;

-- 1. Helper functions to avoid recursion
CREATE OR REPLACE FUNCTION get_user_space_ids(user_uuid UUID)
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT space_id FROM space_members WHERE user_id = user_uuid;
$$;

-- 2. Re-enable RLS on all critical tables
ALTER TABLE spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE space_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox ENABLE ROW LEVEL SECURITY;

-- 3. Clean up old policies
DROP POLICY IF EXISTS "Users can view spaces they belong to" ON spaces;
DROP POLICY IF EXISTS "Owners can update spaces" ON spaces;
DROP POLICY IF EXISTS "Users can create spaces" ON spaces;

DROP POLICY IF EXISTS "Users can view tasks in their spaces" ON tasks;
DROP POLICY IF EXISTS "Editors can create tasks" ON tasks;
DROP POLICY IF EXISTS "Members can update tasks" ON tasks;

DROP POLICY IF EXISTS "Users can view docs in their spaces" ON documents;
DROP POLICY IF EXISTS "Editors can create docs" ON documents;

DROP POLICY IF EXISTS "Users can view own inbox" ON inbox;
DROP POLICY IF EXISTS "Users can insert own inbox" ON inbox;

-- 4. Create proper optimized policies

-- SPACES
CREATE POLICY "Spaces select" ON spaces FOR SELECT 
USING (id IN (SELECT get_user_space_ids(auth.uid())));

CREATE POLICY "Spaces insert" ON spaces FOR INSERT 
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Spaces update" ON spaces FOR UPDATE 
USING (id IN (SELECT space_id FROM space_members WHERE user_id = auth.uid() AND role IN ('admin', 'owner')));

-- TASKS
CREATE POLICY "Tasks select" ON tasks FOR SELECT 
USING (space_id IN (SELECT get_user_space_ids(auth.uid())) OR created_by = auth.uid());

CREATE POLICY "Tasks insert" ON tasks FOR INSERT 
WITH CHECK (space_id IN (SELECT get_user_space_ids(auth.uid())) OR created_by = auth.uid());

CREATE POLICY "Tasks update" ON tasks FOR UPDATE 
USING (space_id IN (SELECT get_user_space_ids(auth.uid())) OR created_by = auth.uid());

-- DOCUMENTS
CREATE POLICY "Docs select" ON documents FOR SELECT 
USING (space_id IN (SELECT get_user_space_ids(auth.uid())) OR created_by = auth.uid());

CREATE POLICY "Docs insert" ON documents FOR INSERT 
WITH CHECK (space_id IN (SELECT get_user_space_ids(auth.uid())) OR created_by = auth.uid());

-- INBOX (Private by default)
CREATE POLICY "Inbox select" ON inbox FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Inbox insert" ON inbox FOR INSERT 
WITH CHECK (user_id = auth.uid());

COMMIT;
