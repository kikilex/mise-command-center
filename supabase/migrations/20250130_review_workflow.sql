-- Review Workflow: Auto-create review tasks when AI agent marks tasks as done
-- This trigger creates a review task when:
-- 1. A task status changes to 'done'
-- 2. The task has ai_agent = 'ax' (completed by AI)

CREATE OR REPLACE FUNCTION create_review_task_for_ai()
RETURNS TRIGGER AS $$
DECLARE
  review_task_id UUID;
  task_creator_id UUID;
BEGIN
  -- Only trigger when status changes TO 'done' and task was done by AI agent 'ax'
  IF (NEW.status = 'done' AND OLD.status != 'done' AND NEW.ai_agent = 'ax') THEN
    -- Get the original task creator
    task_creator_id := NEW.created_by;
    
    -- Don't create review task if no creator (shouldn't happen, but safety check)
    IF task_creator_id IS NULL THEN
      RETURN NEW;
    END IF;
    
    -- Check if a review task already exists for this task (prevent duplicates)
    IF EXISTS (
      SELECT 1 FROM tasks 
      WHERE parent_task_id = NEW.id 
      AND title LIKE 'Review:%'
    ) THEN
      RETURN NEW;
    END IF;
    
    -- Create the review task
    INSERT INTO tasks (
      title,
      description,
      status,
      priority,
      assignee_id,
      created_by,
      project_id,
      business_id,
      parent_task_id,
      tags,
      ai_flag,
      metadata
    ) VALUES (
      'Review: ' || NEW.title,
      'Please review the AI-completed task: "' || NEW.title || '"' || 
        CASE WHEN NEW.description IS NOT NULL 
          THEN E'\n\nOriginal description: ' || NEW.description 
          ELSE '' 
        END,
      'todo',
      'high',
      task_creator_id,  -- Assign to the original task creator
      task_creator_id,  -- Created by the same user (system action)
      NEW.project_id,
      NEW.business_id,
      NEW.id,           -- Link to original task via parent_task_id
      ARRAY['review', 'ai-completed'],
      FALSE,            -- Review tasks are not for AI
      jsonb_build_object(
        'original_task_id', NEW.id,
        'original_task_title', NEW.title,
        'ai_agent', NEW.ai_agent,
        'completed_at', NOW()
      )
    ) RETURNING id INTO review_task_id;
    
    -- Log the review task creation
    INSERT INTO ai_work_log (
      agent_name,
      action,
      task_id,
      details
    ) VALUES (
      'ax',
      'review_task_created',
      NEW.id,
      jsonb_build_object(
        'original_task_id', NEW.id,
        'review_task_id', review_task_id,
        'original_title', NEW.title
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists (for idempotent migrations)
DROP TRIGGER IF EXISTS trigger_create_review_task ON tasks;

-- Create the trigger
CREATE TRIGGER trigger_create_review_task
  AFTER UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION create_review_task_for_ai();

-- Add comment for documentation
COMMENT ON FUNCTION create_review_task_for_ai() IS 
  'Auto-creates a review task when AI agent "ax" marks a task as done. Review task is assigned to the original task creator with high priority.';
