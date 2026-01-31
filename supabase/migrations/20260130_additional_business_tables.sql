-- Migration: Additional Business-Scoped Tables
-- Date: 2026-01-30
-- Description: Updates RLS policies for other tables with business_id
--              Includes: projects, ai_agents

-- =============================================================================
-- 1. PROJECTS TABLE - Business-scoped access
-- =============================================================================
-- Drop old policies
DROP POLICY IF EXISTS "Project members can view" ON projects;
DROP POLICY IF EXISTS "Users can create projects" ON projects;
DROP POLICY IF EXISTS "Project owners can update" ON projects;

-- SELECT: View projects for businesses you belong to
CREATE POLICY "Users can view projects for businesses they belong to" ON projects FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM business_members 
      WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
    )
    OR
    created_by = auth.uid()
    OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'ai'))
  );

-- INSERT: Create projects if you have 'admin' access to the business
CREATE POLICY "Users can create projects" ON projects FOR INSERT 
  WITH CHECK (
    user_has_business_access(business_id, 'admin')
    OR
    auth.uid() = created_by
    OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'ai'))
  );

-- UPDATE: Update if you're the creator or have admin access to the business
CREATE POLICY "Project owners or business admins can update" ON projects FOR UPDATE 
  USING (
    created_by = auth.uid()
    OR
    user_has_business_access(business_id, 'admin')
    OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'ai'))
  );

-- =============================================================================
-- 2. AI_AGENTS TABLE - Business-scoped access
-- =============================================================================
-- Note: ai_agents table has business_id but no existing RLS policies
-- We need to create policies from scratch

-- SELECT: View AI agents for businesses you belong to
CREATE POLICY "Users can view AI agents for their businesses" ON ai_agents FOR SELECT
  USING (
    -- Agents without business_id (global): only admins/AI
    (
      business_id IS NULL 
      AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'ai'))
    )
    OR
    -- Agents with business_id: check business access
    (
      business_id IS NOT NULL
      AND (
        business_id IN (
          SELECT business_id FROM business_members 
          WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
        )
        OR
        EXISTS (SELECT 1 FROM businesses WHERE id = business_id AND owner_id = auth.uid())
        OR
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'ai'))
      )
    )
  );

-- INSERT: Create AI agents if you have 'admin' access to the business
CREATE POLICY "Users can create AI agents" ON ai_agents FOR INSERT 
  WITH CHECK (
    -- Can create global agents if admin/AI
    (
      business_id IS NULL 
      AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'ai'))
    )
    OR
    -- Can create business agents if admin access
    (
      business_id IS NOT NULL
      AND user_has_business_access(business_id, 'admin')
    )
  );

-- UPDATE: Update AI agents if you have 'admin' access
CREATE POLICY "Users can update AI agents" ON ai_agents FOR UPDATE 
  USING (
    -- Can update global agents if admin/AI
    (
      business_id IS NULL 
      AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'ai'))
    )
    OR
    -- Can update business agents if admin access
    (
      business_id IS NOT NULL
      AND user_has_business_access(business_id, 'admin')
    )
  );

-- DELETE: Delete AI agents if you have 'admin' access
CREATE POLICY "Users can delete AI agents" ON ai_agents FOR DELETE 
  USING (
    -- Can delete global agents if admin/AI
    (
      business_id IS NULL 
      AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'ai'))
    )
    OR
    -- Can delete business agents if admin access
    (
      business_id IS NOT NULL
      AND user_has_business_access(business_id, 'admin')
    )
  );

-- =============================================================================
-- 3. NOTES TABLE - Keep existing (user-specific, not business-scoped)
-- =============================================================================
-- Notes are personal to users and don't have business_id
-- Existing policies are fine:
-- - Users can view own notes
-- - Users can create/update/delete own notes
-- - Admins have full access

-- =============================================================================
-- 4. SHOPPING LIST ITEMS - Keep existing (family shared)
-- =============================================================================
-- Shopping list is family shared, not business-scoped
-- Existing policies allow everyone to view/add/update/delete

-- =============================================================================
-- 5. TASK_COMMENTS, DOCUMENT_COMMENTS - Inherit parent access
-- =============================================================================
-- Comments inherit access from their parent (task or document)
-- They don't need separate business-scoped policies
-- Existing policies check parent task/document access