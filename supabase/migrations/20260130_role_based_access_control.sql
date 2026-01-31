-- Migration: Role-Based Access Control with Business Scoping
-- Date: 2026-01-30
-- Description: Implements role-based access control for business data
--              Updates RLS policies for: businesses, tasks, content_items, sales, products, ai_work_log
--              Adds accepted_at to business_members for invitation workflow

-- =============================================================================
-- 1. ADD accepted_at TO business_members FOR INVITATION WORKFLOW
-- =============================================================================
ALTER TABLE business_members 
ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ DEFAULT NOW();

-- Set accepted_at for existing members (they've implicitly accepted)
UPDATE business_members 
SET accepted_at = NOW() 
WHERE accepted_at IS NULL;

-- =============================================================================
-- 2. HELPER FUNCTION: user_has_business_access()
-- =============================================================================
-- Checks if user has required role or higher for a business
-- Role hierarchy: viewer < member < admin < owner
CREATE OR REPLACE FUNCTION user_has_business_access(
  bid UUID, 
  required_role TEXT DEFAULT 'viewer'
) RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
  role_weight INTEGER;
  required_weight INTEGER;
BEGIN
  -- Get user's role for this business (must have accepted invitation)
  SELECT role INTO user_role
  FROM business_members 
  WHERE business_id = bid 
    AND user_id = auth.uid() 
    AND accepted_at IS NOT NULL;
  
  -- If not a member, check if they're the business owner
  IF user_role IS NULL THEN
    SELECT 'owner' INTO user_role
    FROM businesses 
    WHERE id = bid AND owner_id = auth.uid();
  END IF;
  
  -- If still no role, return false
  IF user_role IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Convert roles to weights for comparison
  CASE user_role
    WHEN 'owner' THEN role_weight := 4;
    WHEN 'admin' THEN role_weight := 3;
    WHEN 'member' THEN role_weight := 2;
    WHEN 'viewer' THEN role_weight := 1;
    ELSE role_weight := 0;
  END CASE;
  
  CASE required_role
    WHEN 'owner' THEN required_weight := 4;
    WHEN 'admin' THEN required_weight := 3;
    WHEN 'member' THEN required_weight := 2;
    WHEN 'viewer' THEN required_weight := 1;
    ELSE required_weight := 0;
  END CASE;
  
  -- User has access if their role weight >= required weight
  RETURN role_weight >= required_weight;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 3. BUSINESSES TABLE - Users only see businesses they're members of
-- =============================================================================
-- Drop old SELECT policies
DROP POLICY IF EXISTS "Business members can view" ON businesses;
DROP POLICY IF EXISTS "Admins can view all businesses" ON businesses;

-- New SELECT policy: Business-scoped access
CREATE POLICY "Users can view businesses they belong to" ON businesses FOR SELECT 
  USING (
    -- Accepted business member
    id IN (
      SELECT business_id FROM business_members 
      WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
    )
    OR
    -- Business owner
    owner_id = auth.uid()
    OR
    -- System admin
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- UPDATE and INSERT policies remain unchanged (check owner_id/admin)

-- =============================================================================
-- 4. TASKS TABLE - Role-based access control
-- =============================================================================
-- Drop old policies
DROP POLICY IF EXISTS "Users can view accessible tasks" ON tasks;
DROP POLICY IF EXISTS "Users can create tasks" ON tasks;
DROP POLICY IF EXISTS "Users can update accessible tasks" ON tasks;
DROP POLICY IF EXISTS "Users can delete own tasks" ON tasks;

-- SELECT: View tasks for businesses you belong to
CREATE POLICY "Users can view tasks for businesses they belong to" ON tasks FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM business_members 
      WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
    )
    OR
    EXISTS (SELECT 1 FROM businesses WHERE id = business_id AND owner_id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'ai'))
  );

-- INSERT: Create tasks if you have 'member' access or higher
CREATE POLICY "Users can create tasks" ON tasks FOR INSERT 
  WITH CHECK (
    user_has_business_access(business_id, 'member')
    OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'ai'))
  );

-- UPDATE: Role-based permissions
-- - owner/admin: update any task in business
-- - member: update tasks they created or are assigned to
-- - viewer: read-only (no update)
CREATE POLICY "Users can update tasks based on role" ON tasks FOR UPDATE 
  USING (
    -- Owners/admins have full update access
    user_has_business_access(business_id, 'admin')
    OR
    -- Members can update tasks they created or are assigned to
    (
      user_has_business_access(business_id, 'member') 
      AND (auth.uid() = created_by OR auth.uid() = assignee_id)
    )
    OR
    -- System admins and AI agents
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'ai'))
  );

-- DELETE: Only owners/admins can delete
CREATE POLICY "Owners and admins can delete tasks" ON tasks FOR DELETE 
  USING (
    user_has_business_access(business_id, 'admin')
    OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- =============================================================================
-- 5. CONTENT_ITEMS TABLE (Content Pipeline) - Role-based access control
-- =============================================================================
-- Drop old policies
DROP POLICY IF EXISTS "Business members can view content" ON content_items;
DROP POLICY IF EXISTS "Users can create content" ON content_items;
DROP POLICY IF EXISTS "Business members can update content" ON content_items;

-- SELECT: View content for businesses you belong to
CREATE POLICY "Users can view content for businesses they belong to" ON content_items FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM business_members 
      WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
    )
    OR
    EXISTS (SELECT 1 FROM businesses WHERE id = business_id AND owner_id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'ai'))
  );

-- INSERT: Create content if you have 'member' access or higher
CREATE POLICY "Users can create content" ON content_items FOR INSERT 
  WITH CHECK (
    user_has_business_access(business_id, 'member')
    OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'ai'))
  );

-- UPDATE: Role-based permissions
CREATE POLICY "Users can update content based on role" ON content_items FOR UPDATE 
  USING (
    -- Owners/admins have full update access
    user_has_business_access(business_id, 'admin')
    OR
    -- Members can update content they created
    (
      user_has_business_access(business_id, 'member') 
      AND auth.uid() = created_by
    )
    OR
    -- Reviewers can update content they're reviewing
    (
      user_has_business_access(business_id, 'member') 
      AND auth.uid() = reviewer_id
    )
    OR
    -- System admins and AI agents
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'ai'))
  );

-- =============================================================================
-- 6. SALES TABLE - Business-scoped access
-- =============================================================================
-- Drop old policies
DROP POLICY IF EXISTS "Users can view business sales" ON sales;
DROP POLICY IF EXISTS "Users can insert sales" ON sales;
DROP POLICY IF EXISTS "Users can update own sales" ON sales;
DROP POLICY IF EXISTS "Owners can delete sales" ON sales;

-- SELECT: View sales for businesses you belong to
CREATE POLICY "Users can view sales for businesses they belong to" ON sales FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM business_members 
      WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
    )
    OR
    EXISTS (SELECT 1 FROM businesses WHERE id = business_id AND owner_id = auth.uid())
  );

-- INSERT: Insert sales if you belong to the business
CREATE POLICY "Users can insert sales" ON sales FOR INSERT 
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM business_members 
      WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
    )
    OR
    EXISTS (SELECT 1 FROM businesses WHERE id = business_id AND owner_id = auth.uid())
  );

-- UPDATE: Update your own sales or if you have admin access
CREATE POLICY "Users can update sales based on role" ON sales FOR UPDATE 
  USING (
    -- Users can update their own sales
    created_by = auth.uid()
    OR
    -- Owners/admins can update any sales
    user_has_business_access(business_id, 'admin')
  );

-- DELETE: Only owners/admins can delete
CREATE POLICY "Owners and admins can delete sales" ON sales FOR DELETE 
  USING (
    user_has_business_access(business_id, 'admin')
  );

-- =============================================================================
-- 7. PRODUCTS TABLE - Business-scoped access
-- =============================================================================
-- Drop old policies
DROP POLICY IF EXISTS "Users can view business products" ON products;
DROP POLICY IF EXISTS "Users can insert products" ON products;
DROP POLICY IF EXISTS "Users can update products" ON products;
DROP POLICY IF EXISTS "Users can delete products" ON products;

-- SELECT: View products for businesses you belong to
CREATE POLICY "Users can view products for businesses they belong to" ON products FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM business_members 
      WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
    )
    OR
    EXISTS (SELECT 1 FROM businesses WHERE id = business_id AND owner_id = auth.uid())
  );

-- INSERT: Insert products if you have 'admin' access
CREATE POLICY "Users can insert products" ON products FOR INSERT 
  WITH CHECK (
    user_has_business_access(business_id, 'admin')
  );

-- UPDATE: Update products if you have 'admin' access
CREATE POLICY "Users can update products" ON products FOR UPDATE 
  USING (
    user_has_business_access(business_id, 'admin')
  );

-- DELETE: Only owners can delete products
CREATE POLICY "Owners can delete products" ON products FOR DELETE 
  USING (
    EXISTS (SELECT 1 FROM businesses WHERE id = business_id AND owner_id = auth.uid())
  );

-- =============================================================================
-- 8. AI_WORK_LOG TABLE - Business-scoped access
-- =============================================================================
-- Drop old policies
DROP POLICY IF EXISTS "Admins can view AI log" ON ai_work_log;
DROP POLICY IF EXISTS "AI can insert logs" ON ai_work_log;

-- SELECT: View AI logs for your businesses (through task association)
CREATE POLICY "Users can view AI logs for their businesses" ON ai_work_log FOR SELECT
  USING (
    -- Logs without task_id: only admins/AI
    (
      task_id IS NULL 
      AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'ai'))
    )
    OR
    -- Logs with task_id: check business access through task
    (
      task_id IS NOT NULL
      AND task_id IN (
        SELECT t.id FROM tasks t
        WHERE t.business_id IN (
          SELECT business_id FROM business_members 
          WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
        )
        OR EXISTS (SELECT 1 FROM businesses WHERE id = t.business_id AND owner_id = auth.uid())
      )
    )
    OR
    -- System admins and AI can view all
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'ai'))
  );

-- INSERT: AI and admins can insert logs (unchanged)
CREATE POLICY "AI and admins can insert logs" ON ai_work_log FOR INSERT 
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'ai'))
  );

-- =============================================================================
-- 9. VERIFICATION QUERIES (Optional - for testing)
-- =============================================================================
/*
-- Test the helper function
SELECT user_has_business_access('business-uuid-here', 'member');

-- Check policies exist
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename IN ('businesses', 'tasks', 'content_items', 'sales', 'products', 'ai_work_log')
ORDER BY tablename, policyname;
*/