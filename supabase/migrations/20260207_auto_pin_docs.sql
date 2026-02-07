-- Auto-pin documents to their project when project_id is set
CREATE OR REPLACE FUNCTION auto_pin_document_to_project()
RETURNS TRIGGER AS $$
BEGIN
  -- Only if project_id is set and not null
  IF NEW.project_id IS NOT NULL THEN
    -- Check if pin already exists
    IF NOT EXISTS (
      SELECT 1 FROM project_pins 
      WHERE project_id = NEW.project_id 
      AND url = '/docs/' || NEW.id::text
    ) THEN
      INSERT INTO project_pins (project_id, title, pin_type, url, position, created_by)
      VALUES (
        NEW.project_id,
        NEW.title,
        'doc',
        '/docs/' || NEW.id::text,
        (SELECT COALESCE(MAX(position), -1) + 1 FROM project_pins WHERE project_id = NEW.project_id),
        NEW.created_by
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS trigger_auto_pin_document ON documents;

-- Create trigger on INSERT
CREATE TRIGGER trigger_auto_pin_document
  AFTER INSERT ON documents
  FOR EACH ROW
  EXECUTE FUNCTION auto_pin_document_to_project();

-- Also handle UPDATE (if project_id is set on existing doc)
DROP TRIGGER IF EXISTS trigger_auto_pin_document_update ON documents;

CREATE TRIGGER trigger_auto_pin_document_update
  AFTER UPDATE OF project_id ON documents
  FOR EACH ROW
  WHEN (OLD.project_id IS DISTINCT FROM NEW.project_id AND NEW.project_id IS NOT NULL)
  EXECUTE FUNCTION auto_pin_document_to_project();
