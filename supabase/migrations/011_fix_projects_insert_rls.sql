-- Fix projects RLS for INSERT operations
-- The previous policy used USING which doesn't apply to INSERT
-- Need to add WITH CHECK for insert operations

-- Drop the existing policy
DROP POLICY IF EXISTS "Users can manage projects" ON projects;

-- Create separate policies for different operations
CREATE POLICY "Users can view projects"
  ON projects FOR SELECT
  USING (
    (business_id IS NULL AND created_by = auth.uid())
    OR business_id IN (
      SELECT business_id FROM business_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert projects"
  ON projects FOR INSERT
  WITH CHECK (
    (business_id IS NULL AND created_by = auth.uid())
    OR business_id IN (
      SELECT business_id FROM business_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update projects"
  ON projects FOR UPDATE
  USING (
    (business_id IS NULL AND created_by = auth.uid())
    OR business_id IN (
      SELECT business_id FROM business_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete projects"
  ON projects FOR DELETE
  USING (
    (business_id IS NULL AND created_by = auth.uid())
    OR business_id IN (
      SELECT business_id FROM business_members WHERE user_id = auth.uid()
    )
  );
