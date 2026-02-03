-- Create task_comments table
CREATE TABLE task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  agent_task_id UUID REFERENCES agent_tasks(id) ON DELETE CASCADE,
  author_type TEXT NOT NULL CHECK (author_type IN ('human', 'agent')),
  author_id UUID REFERENCES users(id),        -- for humans
  author_agent TEXT,                           -- for agents (slug like 'ax', 'tony')
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',                 -- for attachments, links, etc later
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT task_or_agent_task CHECK (
    (task_id IS NOT NULL AND agent_task_id IS NULL) OR
    (task_id IS NULL AND agent_task_id IS NOT NULL) OR
    (task_id IS NOT NULL AND agent_task_id IS NOT NULL)
  )
);

CREATE INDEX idx_task_comments_task_id ON task_comments(task_id);
CREATE INDEX idx_task_comments_agent_task_id ON task_comments(agent_task_id);
CREATE INDEX idx_task_comments_created ON task_comments(created_at);

-- RLS Policies
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;

-- Anyone can read comments for tasks/agent_tasks they can see
CREATE POLICY "Users can view comments"
ON task_comments FOR SELECT
USING (
  (task_id IS NOT NULL AND task_id IN (SELECT id FROM tasks)) OR
  (agent_task_id IS NOT NULL) -- for now, assume visibility
);

-- Users can insert their own comments
CREATE POLICY "Users can insert comments"
ON task_comments FOR INSERT
WITH CHECK (
  author_type = 'human' AND author_id = auth.uid()
);
