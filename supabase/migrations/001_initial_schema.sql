-- Mise Command Center - Initial Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- BUSINESSES (Multi-Business Support)
-- ============================================
CREATE TABLE IF NOT EXISTS businesses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  logo_url TEXT,
  color TEXT DEFAULT '#3b82f6',
  ai_ceo_agent TEXT,
  owner_id UUID,
  settings JSONB DEFAULT '{
    "modules": ["tasks", "content", "sales", "products"],
    "autonomy_level": "medium"
  }',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- USERS (Profiles extending Supabase Auth)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'manager', 'member', 'ai')),
  settings JSONB DEFAULT '{
    "theme": "system",
    "notifications": true,
    "emailDigest": "daily",
    "defaultView": "kanban"
  }',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- BUSINESS MEMBERS (User-Business Relationship)
-- ============================================
CREATE TABLE IF NOT EXISTS business_members (
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  permissions JSONB DEFAULT '{}',
  PRIMARY KEY (business_id, user_id)
);

-- Add foreign key for businesses.owner_id after users table exists
ALTER TABLE businesses 
  ADD CONSTRAINT fk_businesses_owner 
  FOREIGN KEY (owner_id) REFERENCES users(id);

-- ============================================
-- PROJECTS
-- ============================================
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'archived')),
  color TEXT DEFAULT '#3b82f6',
  owner_id UUID REFERENCES users(id),
  business_id UUID REFERENCES businesses(id),
  due_date TIMESTAMPTZ,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PROJECT MEMBERS
-- ============================================
CREATE TABLE IF NOT EXISTS project_members (
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  PRIMARY KEY (project_id, user_id)
);

-- ============================================
-- TASKS
-- ============================================
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'todo' CHECK (status IN ('backlog', 'todo', 'in_progress', 'review', 'done', 'blocked')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  assignee_id UUID REFERENCES users(id),
  created_by UUID REFERENCES users(id) NOT NULL,
  project_id UUID REFERENCES projects(id),
  business_id UUID REFERENCES businesses(id),
  parent_task_id UUID REFERENCES tasks(id),
  due_date TIMESTAMPTZ,
  tags TEXT[] DEFAULT '{}',
  ai_flag BOOLEAN DEFAULT FALSE,
  ai_agent TEXT,
  estimated_minutes INTEGER,
  actual_minutes INTEGER,
  position INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TASK COMMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS task_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CONTENT ITEMS (Testimony Pipeline)
-- ============================================
CREATE TABLE IF NOT EXISTS content_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  type TEXT DEFAULT 'testimony' CHECK (type IN ('testimony', 'educational', 'promotional', 'other')),
  status TEXT DEFAULT 'idea' CHECK (status IN ('idea', 'script', 'review', 'approved', 'voiceover', 'video', 'scheduled', 'posted')),
  business_id UUID REFERENCES businesses(id) NOT NULL,
  script TEXT,
  hook TEXT,
  source TEXT,
  actor_prompt TEXT,
  voice TEXT,
  review_notes TEXT,
  reviewer_id UUID REFERENCES users(id),
  platforms TEXT[] DEFAULT '{}',
  scheduled_date TIMESTAMPTZ,
  posted_date TIMESTAMPTZ,
  performance JSONB DEFAULT '{}',
  task_id UUID REFERENCES tasks(id),
  created_by UUID REFERENCES users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AI AGENTS
-- ============================================
CREATE TABLE IF NOT EXISTS ai_agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('umbrella_ceo', 'business_ceo', 'coder', 'researcher', 'content_creator')),
  business_id UUID REFERENCES businesses(id),
  model TEXT DEFAULT 'deepseek-v3',
  system_prompt TEXT,
  capabilities TEXT[] DEFAULT '{}',
  settings JSONB DEFAULT '{
    "autonomy_level": "medium",
    "can_spawn_agents": false,
    "daily_token_budget": 1000000,
    "working_hours": "00:00-23:59"
  }',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AI WORK LOG
-- ============================================
CREATE TABLE IF NOT EXISTS ai_work_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_name TEXT DEFAULT 'ax',
  action TEXT NOT NULL,
  task_id UUID REFERENCES tasks(id),
  details JSONB DEFAULT '{}',
  tokens_used INTEGER,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- NOTES
-- ============================================
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  content TEXT,
  folder TEXT DEFAULT 'general',
  owner_id UUID REFERENCES users(id) NOT NULL,
  project_id UUID REFERENCES projects(id),
  tags TEXT[] DEFAULT '{}',
  is_pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SHOPPING LIST ITEMS
-- ============================================
CREATE TABLE IF NOT EXISTS shopping_list_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  quantity TEXT,
  category TEXT,
  is_checked BOOLEAN DEFAULT FALSE,
  added_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_business ON tasks(business_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_ai_flag ON tasks(ai_flag) WHERE ai_flag = TRUE;
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_content_status ON content_items(status);
CREATE INDEX IF NOT EXISTS idx_content_business ON content_items(business_id);
CREATE INDEX IF NOT EXISTS idx_ai_log_created ON ai_work_log(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_log_agent ON ai_work_log(agent_name);
CREATE INDEX IF NOT EXISTS idx_projects_business ON projects(business_id);
CREATE INDEX IF NOT EXISTS idx_notes_owner ON notes(owner_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_work_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_list_items ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Users: can view all users, update own profile
CREATE POLICY "Users can view all users" ON users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON users FOR INSERT WITH CHECK (auth.uid() = id);

-- Businesses: members can view, owners can update
CREATE POLICY "Business members can view" ON businesses FOR SELECT 
  USING (id IN (SELECT business_id FROM business_members WHERE user_id = auth.uid()));
CREATE POLICY "Admins can view all businesses" ON businesses FOR SELECT 
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Business owners can update" ON businesses FOR UPDATE 
  USING (owner_id = auth.uid());
CREATE POLICY "Admins can insert businesses" ON businesses FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- Tasks: accessible to creator, assignee, or project members
CREATE POLICY "Users can view accessible tasks" ON tasks FOR SELECT 
  USING (
    auth.uid() = created_by OR
    auth.uid() = assignee_id OR
    project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()) OR
    business_id IN (SELECT business_id FROM business_members WHERE user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'ai'))
  );
CREATE POLICY "Users can create tasks" ON tasks FOR INSERT 
  WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can update accessible tasks" ON tasks FOR UPDATE 
  USING (
    auth.uid() = created_by OR
    auth.uid() = assignee_id OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'ai'))
  );
CREATE POLICY "Users can delete own tasks" ON tasks FOR DELETE 
  USING (auth.uid() = created_by OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- Projects: accessible to members
CREATE POLICY "Project members can view" ON projects FOR SELECT 
  USING (
    owner_id = auth.uid() OR
    id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()) OR
    business_id IN (SELECT business_id FROM business_members WHERE user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'ai'))
  );
CREATE POLICY "Users can create projects" ON projects FOR INSERT 
  WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Project owners can update" ON projects FOR UPDATE 
  USING (owner_id = auth.uid() OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- Content items: business members can access
CREATE POLICY "Business members can view content" ON content_items FOR SELECT 
  USING (
    business_id IN (SELECT business_id FROM business_members WHERE user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'ai'))
  );
CREATE POLICY "Users can create content" ON content_items FOR INSERT 
  WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Business members can update content" ON content_items FOR UPDATE 
  USING (
    created_by = auth.uid() OR
    reviewer_id = auth.uid() OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'ai'))
  );

-- AI work log: admins and AI can view/insert
CREATE POLICY "Admins can view AI log" ON ai_work_log FOR SELECT 
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'ai')));
CREATE POLICY "AI can insert logs" ON ai_work_log FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'ai')));

-- Notes: owner can access
CREATE POLICY "Users can view own notes" ON notes FOR SELECT 
  USING (owner_id = auth.uid() OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Users can create notes" ON notes FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can update own notes" ON notes FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "Users can delete own notes" ON notes FOR DELETE USING (owner_id = auth.uid());

-- Shopping list: everyone can access (family shared)
CREATE POLICY "Everyone can view shopping list" ON shopping_list_items FOR SELECT USING (true);
CREATE POLICY "Everyone can add shopping items" ON shopping_list_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Everyone can update shopping items" ON shopping_list_items FOR UPDATE USING (true);
CREATE POLICY "Everyone can delete shopping items" ON shopping_list_items FOR DELETE USING (true);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_businesses_updated_at BEFORE UPDATE ON businesses FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_task_comments_updated_at BEFORE UPDATE ON task_comments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_content_items_updated_at BEFORE UPDATE ON content_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_ai_agents_updated_at BEFORE UPDATE ON ai_agents FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_notes_updated_at BEFORE UPDATE ON notes FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function to create user profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    CASE 
      WHEN NEW.email = 'axmise24@gmail.com' THEN 'admin'
      ELSE 'member'
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- SEED DATA
-- ============================================

-- Create default business
INSERT INTO businesses (name, slug, description, color)
VALUES ('Christian Content Empire', 'christian-content', 'Spiritual Warfare Prayers and faith-based content', '#8b5cf6')
ON CONFLICT (slug) DO NOTHING;

-- Create default AI agent (Ax)
INSERT INTO ai_agents (name, slug, role, model, system_prompt, capabilities, settings)
VALUES (
  'Ax',
  'ax',
  'umbrella_ceo',
  'claude-opus-4',
  'You are Ax, the umbrella AI CEO for Mise Holdings. You orchestrate all business operations and delegate to business-specific agents.',
  ARRAY['orchestration', 'task_management', 'content_review', 'agent_spawning'],
  '{
    "autonomy_level": "high",
    "can_spawn_agents": true,
    "daily_token_budget": 5000000,
    "working_hours": "00:00-23:59"
  }'
)
ON CONFLICT (slug) DO NOTHING;
