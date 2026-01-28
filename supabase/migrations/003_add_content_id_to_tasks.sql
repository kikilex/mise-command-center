-- Add content_id foreign key to tasks table
-- This allows linking tasks to content pipeline items

ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS content_id UUID REFERENCES content_items(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_tasks_content ON tasks(content_id);
