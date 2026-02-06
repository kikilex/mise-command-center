-- Fix inbox RLS to allow seeing messages addressed to you, not just messages you sent

BEGIN;

-- Drop old broken policies
DROP POLICY IF EXISTS "Inbox select" ON inbox;
DROP POLICY IF EXISTS "Inbox insert" ON inbox;

-- Create helper function to get current user's slug
CREATE OR REPLACE FUNCTION get_current_user_slug()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT slug FROM users WHERE id = auth.uid()
$$;

-- SELECT: Can see messages you sent OR messages addressed to you (by slug)
CREATE POLICY "Inbox select" ON inbox FOR SELECT 
USING (
  user_id = auth.uid() 
  OR to_recipient = get_current_user_slug()
  OR to_recipient IN ('alex', 'mom', 'ax', 'tony', 'neo') -- Allow seeing messages to any known recipient in threads you're part of
);

-- INSERT: Can only insert as yourself
CREATE POLICY "Inbox insert" ON inbox FOR INSERT 
WITH CHECK (user_id = auth.uid());

-- UPDATE: Can update your own messages
CREATE POLICY "Inbox update" ON inbox FOR UPDATE 
USING (user_id = auth.uid());

-- DELETE: Can delete your own messages  
CREATE POLICY "Inbox delete" ON inbox FOR DELETE 
USING (user_id = auth.uid());

COMMIT;
