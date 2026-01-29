-- Add DELETE policy for content_items
-- Allows creators and admins/ai to delete content

CREATE POLICY "Users can delete their content" ON content_items FOR DELETE 
  USING (
    created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'ai'))
  );
