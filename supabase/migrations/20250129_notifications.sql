-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('task_assigned', 'feedback_received', 'status_changed', 'due_soon', 'revision_requested')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read) WHERE read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies: users can only see their own notifications
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own notifications" ON notifications
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Service role can do anything (for triggers and AI)
CREATE POLICY "Service role has full access to notifications" ON notifications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow inserting notifications for any user (triggers need this)
CREATE POLICY "Allow insert notifications" ON notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================
-- NOTIFICATION TRIGGER FUNCTIONS
-- ============================================

-- Function to create notification when task is assigned (ai_agent changes)
CREATE OR REPLACE FUNCTION notify_task_assigned()
RETURNS TRIGGER AS $$
DECLARE
  task_title TEXT;
  target_user_id UUID;
BEGIN
  -- Check if ai_agent changed and is not null
  IF (TG_OP = 'UPDATE' AND NEW.ai_agent IS DISTINCT FROM OLD.ai_agent AND NEW.ai_agent IS NOT NULL) THEN
    task_title := NEW.title;
    
    -- Find user with matching ai_agent name (case insensitive)
    SELECT id INTO target_user_id 
    FROM users 
    WHERE LOWER(name) = LOWER(NEW.ai_agent) OR LOWER(email) LIKE LOWER(NEW.ai_agent) || '%'
    LIMIT 1;
    
    -- If no matching user, skip (could be actual AI agent)
    IF target_user_id IS NULL THEN
      RETURN NEW;
    END IF;
    
    -- Create notification
    INSERT INTO notifications (user_id, type, title, message, task_id)
    VALUES (
      target_user_id,
      'task_assigned',
      'Task Assigned to You',
      'You have been assigned: ' || task_title,
      NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create notification when feedback is added
CREATE OR REPLACE FUNCTION notify_feedback_received()
RETURNS TRIGGER AS $$
DECLARE
  task_record RECORD;
  target_user_id UUID;
BEGIN
  -- Get task info
  SELECT t.id, t.title, t.created_by, t.ai_agent 
  INTO task_record
  FROM tasks t
  WHERE t.id = NEW.task_id;
  
  -- Determine who to notify (task creator or assigned agent's user)
  IF NEW.author = 'ax' THEN
    -- AI sent feedback, notify task creator
    target_user_id := task_record.created_by;
  ELSE
    -- Human sent feedback, try to find the ai_agent's user
    SELECT id INTO target_user_id 
    FROM users 
    WHERE LOWER(name) = LOWER(task_record.ai_agent) OR LOWER(email) LIKE LOWER(task_record.ai_agent) || '%'
    LIMIT 1;
    
    -- If no matching user, notify task creator instead
    IF target_user_id IS NULL THEN
      target_user_id := task_record.created_by;
    END IF;
  END IF;
  
  -- Don't notify the person who sent the feedback
  IF target_user_id = NEW.author::UUID THEN
    RETURN NEW;
  END IF;
  
  -- Create notification
  INSERT INTO notifications (user_id, type, title, message, task_id)
  VALUES (
    target_user_id,
    'feedback_received',
    'New Feedback',
    'New feedback on: ' || task_record.title,
    NEW.task_id
  );
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Silently fail rather than break the insert
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create notification when status changes
CREATE OR REPLACE FUNCTION notify_status_changed()
RETURNS TRIGGER AS $$
DECLARE
  target_user_id UUID;
BEGIN
  -- Only notify on status change
  IF (TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status) THEN
    -- Find user associated with ai_agent
    IF NEW.ai_agent IS NOT NULL THEN
      SELECT id INTO target_user_id 
      FROM users 
      WHERE LOWER(name) = LOWER(NEW.ai_agent) OR LOWER(email) LIKE LOWER(NEW.ai_agent) || '%'
      LIMIT 1;
    END IF;
    
    -- Fall back to task creator
    IF target_user_id IS NULL THEN
      target_user_id := NEW.created_by;
    END IF;
    
    -- Create notification
    INSERT INTO notifications (user_id, type, title, message, task_id)
    VALUES (
      target_user_id,
      'status_changed',
      'Task Status Changed',
      NEW.title || ' moved to ' || REPLACE(NEW.status, '_', ' '),
      NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create notification when task is sent back for revision
CREATE OR REPLACE FUNCTION notify_revision_requested()
RETURNS TRIGGER AS $$
DECLARE
  target_user_id UUID;
BEGIN
  -- Check if task was sent back to ax (ai_agent changed to 'ax' and status is 'in_progress')
  IF (TG_OP = 'UPDATE' AND 
      NEW.ai_agent = 'ax' AND 
      OLD.ai_agent IS DISTINCT FROM NEW.ai_agent) THEN
    
    -- Find ax user (the AI umbrella CEO)
    SELECT id INTO target_user_id 
    FROM users 
    WHERE role = 'ai' OR LOWER(name) = 'ax'
    LIMIT 1;
    
    -- If no ax user, notify task creator
    IF target_user_id IS NULL THEN
      target_user_id := NEW.created_by;
    END IF;
    
    -- Create notification
    INSERT INTO notifications (user_id, type, title, message, task_id)
    VALUES (
      target_user_id,
      'revision_requested',
      'Revision Requested',
      'Task needs revision: ' || NEW.title,
      NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- CREATE TRIGGERS
-- ============================================

DROP TRIGGER IF EXISTS trigger_notify_task_assigned ON tasks;
CREATE TRIGGER trigger_notify_task_assigned
  AFTER UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION notify_task_assigned();

DROP TRIGGER IF EXISTS trigger_notify_feedback_received ON task_feedback;
CREATE TRIGGER trigger_notify_feedback_received
  AFTER INSERT ON task_feedback
  FOR EACH ROW
  EXECUTE FUNCTION notify_feedback_received();

DROP TRIGGER IF EXISTS trigger_notify_status_changed ON tasks;
CREATE TRIGGER trigger_notify_status_changed
  AFTER UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION notify_status_changed();

DROP TRIGGER IF EXISTS trigger_notify_revision_requested ON tasks;
CREATE TRIGGER trigger_notify_revision_requested
  AFTER UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION notify_revision_requested();
