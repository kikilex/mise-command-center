-- ============================================
-- CONTENT PROMPTS
-- Store individual prompts split from scripts
-- ============================================

CREATE TABLE IF NOT EXISTS content_prompts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  scene_number INTEGER NOT NULL,
  text TEXT NOT NULL,
  duration_seconds INTEGER DEFAULT 3,
  actor_prompt TEXT,
  image_url TEXT,
  image_status TEXT DEFAULT 'pending' CHECK (image_status IN ('pending', 'generating', 'generated', 'failed')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_content_prompts_content ON content_prompts(content_id);
CREATE INDEX IF NOT EXISTS idx_content_prompts_scene ON content_prompts(content_id, scene_number);

-- RLS
ALTER TABLE content_prompts ENABLE ROW LEVEL SECURITY;

-- Users can view prompts for content they have access to
CREATE POLICY "view_content_prompts" ON content_prompts FOR SELECT
  USING (
    content_id IN (
      SELECT ci.id FROM content_items ci
      WHERE ci.business_id IN (
        SELECT business_id FROM business_members WHERE user_id = auth.uid()
      )
    )
  );

-- Users can manage prompts for content they have access to
CREATE POLICY "manage_content_prompts" ON content_prompts FOR ALL
  USING (
    content_id IN (
      SELECT ci.id FROM content_items ci
      WHERE ci.business_id IN (
        SELECT business_id FROM business_members WHERE user_id = auth.uid()
      )
    )
  );
