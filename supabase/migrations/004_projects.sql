-- ============================================
-- PROJECTS & TEMPLATES
-- Dynamic project system with customizable fields
-- ============================================

-- Project templates define what fields a project type has
CREATE TABLE IF NOT EXISTS project_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,                    -- "Goal", "Feature", "Campaign", etc.
  description TEXT,
  icon TEXT DEFAULT '📁',                -- Emoji for the template
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,  -- NULL = global/personal
  fields JSONB NOT NULL DEFAULT '[]',    -- Array of field definitions
  -- Field definition: {name, type, label, required, options (for select)}
  -- Types: text, textarea, number, date, select, checkbox, url
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Projects themselves
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  template_id UUID REFERENCES project_templates(id) ON DELETE SET NULL,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,  -- NULL = personal
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived', 'on_hold')),
  custom_fields JSONB DEFAULT '{}',      -- Actual field values
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link tasks to projects
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

-- Link content to projects  
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_projects_business ON projects(business_id);
CREATE INDEX IF NOT EXISTS idx_projects_template ON projects(template_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_project_templates_business ON project_templates(business_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_content_project ON content_items(project_id);

-- RLS
ALTER TABLE project_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Templates: viewable by business members or if global (business_id IS NULL)
CREATE POLICY "Users can view templates for their businesses or global"
  ON project_templates FOR SELECT
  USING (
    business_id IS NULL 
    OR business_id IN (
      SELECT business_id FROM business_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage templates for their businesses"
  ON project_templates FOR ALL
  USING (
    business_id IN (
      SELECT business_id FROM business_members WHERE user_id = auth.uid()
    )
    OR created_by = auth.uid()
  );

-- Projects: viewable/editable by business members
CREATE POLICY "Users can view projects for their businesses or personal"
  ON projects FOR SELECT
  USING (
    business_id IS NULL AND created_by = auth.uid()
    OR business_id IN (
      SELECT business_id FROM business_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage projects"
  ON projects FOR ALL
  USING (
    business_id IS NULL AND created_by = auth.uid()
    OR business_id IN (
      SELECT business_id FROM business_members WHERE user_id = auth.uid()
    )
  );

-- Insert some default templates
INSERT INTO project_templates (name, description, icon, business_id, fields) VALUES
(
  'Goal',
  'Personal or business goal with target date and progress tracking',
  '🎯',
  NULL,
  '[
    {"name": "target_date", "type": "date", "label": "Target Date", "required": false},
    {"name": "progress", "type": "number", "label": "Progress (%)", "required": false},
    {"name": "milestones", "type": "textarea", "label": "Milestones", "required": false},
    {"name": "motivation", "type": "text", "label": "Why This Matters", "required": false}
  ]'::jsonb
),
(
  'Feature',
  'Product feature or development project',
  '🚀',
  NULL,
  '[
    {"name": "status", "type": "select", "label": "Status", "required": true, "options": ["Planning", "In Development", "Testing", "Launched"]},
    {"name": "priority", "type": "select", "label": "Priority", "required": false, "options": ["Low", "Medium", "High", "Critical"]},
    {"name": "launch_date", "type": "date", "label": "Target Launch", "required": false},
    {"name": "specs_url", "type": "url", "label": "Specs/Docs Link", "required": false},
    {"name": "notes", "type": "textarea", "label": "Notes", "required": false}
  ]'::jsonb
),
(
  'Campaign',
  'Marketing or content campaign',
  '📣',
  NULL,
  '[
    {"name": "start_date", "type": "date", "label": "Start Date", "required": false},
    {"name": "end_date", "type": "date", "label": "End Date", "required": false},
    {"name": "budget", "type": "number", "label": "Budget ($)", "required": false},
    {"name": "platforms", "type": "text", "label": "Platforms", "required": false},
    {"name": "goal", "type": "textarea", "label": "Campaign Goal", "required": false}
  ]'::jsonb
),
(
  'Simple',
  'Basic project with minimal fields',
  '📁',
  NULL,
  '[
    {"name": "due_date", "type": "date", "label": "Due Date", "required": false},
    {"name": "notes", "type": "textarea", "label": "Notes", "required": false}
  ]'::jsonb
);
