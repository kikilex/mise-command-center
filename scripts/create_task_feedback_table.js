// Script to create task_feedback table via Supabase Management API
const SUPABASE_URL = 'https://hrgluluiwjqgcybswiha.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhyZ2x1bHVpd2pxZ2N5YnN3aWhhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTYxMjQ2NiwiZXhwIjoyMDg1MTg4NDY2fQ.0pnde3F6_QMEBmcFPhv1lsP6I_aVZeTris6SPE_8to0'
const ACCESS_TOKEN = 'sbp_81a17314a395caf2c14dca49643f4cfaac28a511'
const PROJECT_REF = 'hrgluluiwjqgcybswiha'

const sql = `
-- Create task_feedback table for chat-style feedback
CREATE TABLE IF NOT EXISTS task_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_task_feedback_task_id ON task_feedback(task_id);
CREATE INDEX IF NOT EXISTS idx_task_feedback_created_at ON task_feedback(created_at);

-- Enable RLS
ALTER TABLE task_feedback ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read task feedback" ON task_feedback;
DROP POLICY IF EXISTS "Users can insert task feedback" ON task_feedback;
DROP POLICY IF EXISTS "Service role has full access to task feedback" ON task_feedback;

-- RLS Policies
CREATE POLICY "Users can read task feedback" ON task_feedback
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert task feedback" ON task_feedback
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Service role has full access to task feedback" ON task_feedback
  FOR ALL TO service_role USING (true) WITH CHECK (true);
`;

async function runQuery() {
  const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  
  const result = await response.text();
  console.log('Status:', response.status);
  console.log('Result:', result);
}

runQuery().catch(console.error);
