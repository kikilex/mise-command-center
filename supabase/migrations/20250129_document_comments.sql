-- Document Comments Table for revision workflow
-- Run this in Supabase SQL Editor

-- ============================================
-- DOCUMENT COMMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS document_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  author_id UUID REFERENCES users(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL DEFAULT 'System',
  comment_type TEXT DEFAULT 'comment' CHECK (comment_type IN ('comment', 'revision_request', 'status_change')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by document
CREATE INDEX IF NOT EXISTS idx_document_comments_document ON document_comments(document_id);
CREATE INDEX IF NOT EXISTS idx_document_comments_created ON document_comments(created_at);

-- Enable RLS
ALTER TABLE document_comments ENABLE ROW LEVEL SECURITY;

-- Policies: Anyone can view comments on documents they can see
CREATE POLICY "Users can view document comments" ON document_comments FOR SELECT 
  USING (
    document_id IN (
      SELECT id FROM documents WHERE 
        created_by = auth.uid() OR
        task_id IN (SELECT id FROM tasks WHERE created_by = auth.uid() OR assignee_id = auth.uid()) OR
        business_id IN (SELECT business_id FROM business_members WHERE user_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'ai'))
    )
  );

CREATE POLICY "Users can insert document comments" ON document_comments FOR INSERT 
  WITH CHECK (
    document_id IN (
      SELECT id FROM documents WHERE 
        created_by = auth.uid() OR
        task_id IN (SELECT id FROM tasks WHERE created_by = auth.uid() OR assignee_id = auth.uid()) OR
        business_id IN (SELECT business_id FROM business_members WHERE user_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'ai'))
    )
  );

-- Allow service role full access
CREATE POLICY "Service role full access to document comments" ON document_comments 
  USING (true) 
  WITH CHECK (true);
