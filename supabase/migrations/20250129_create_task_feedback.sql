-- Create task_feedback table for chat-style feedback
CREATE TABLE IF NOT EXISTS task_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author TEXT NOT NULL, -- user_id (UUID) or 'ax' for AI
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_task_feedback_task_id ON task_feedback(task_id);
CREATE INDEX IF NOT EXISTS idx_task_feedback_created_at ON task_feedback(created_at);

-- Enable RLS
ALTER TABLE task_feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Allow authenticated users to read all feedback for their accessible tasks
CREATE POLICY "Users can read task feedback" ON task_feedback
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert feedback
CREATE POLICY "Users can insert task feedback" ON task_feedback
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow service role full access
CREATE POLICY "Service role has full access to task feedback" ON task_feedback
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
