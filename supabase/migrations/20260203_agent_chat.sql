-- Agent Chat Table: Logs all agent-to-agent communication
-- Created: 2026-02-03

CREATE TABLE IF NOT EXISTS agent_chat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Who sent and received
  from_agent TEXT NOT NULL,  -- 'ax' or 'tony'
  to_agent TEXT NOT NULL,    -- 'ax' or 'tony'
  
  -- Message content
  message TEXT NOT NULL,
  
  -- Optional context
  context JSONB DEFAULT '{}',  -- webhook type, job_id, etc.
  
  -- For threading/conversations
  thread_id UUID,  -- optional, for grouping related messages
  
  -- Status
  delivered BOOLEAN DEFAULT FALSE,
  delivered_at TIMESTAMPTZ
);

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_agent_chat_created_at ON agent_chat(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_chat_from_agent ON agent_chat(from_agent);
CREATE INDEX IF NOT EXISTS idx_agent_chat_to_agent ON agent_chat(to_agent);
CREATE INDEX IF NOT EXISTS idx_agent_chat_thread ON agent_chat(thread_id);

-- RLS Policies
ALTER TABLE agent_chat ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all agent chats (it's internal comms)
CREATE POLICY "Anyone can read agent chat" ON agent_chat
  FOR SELECT USING (true);

-- Allow service role to insert (agents use service key)
CREATE POLICY "Service role can insert agent chat" ON agent_chat
  FOR INSERT WITH CHECK (true);

-- Allow service role to update (mark as delivered)
CREATE POLICY "Service role can update agent chat" ON agent_chat
  FOR UPDATE USING (true);

COMMENT ON TABLE agent_chat IS 'Logs all communication between AI agents (Ax and Tony)';
