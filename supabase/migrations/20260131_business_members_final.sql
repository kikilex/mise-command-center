-- Business Members Table Enhancement for Role-Based Access Control
-- This migration enhances the existing business_members table with proper RLS policies

-- Add missing columns to business_members table
ALTER TABLE business_members 
ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Set IDs for existing rows
UPDATE business_members SET id = gen_random_uuid() WHERE id IS NULL;

-- Make id the primary key (drop existing composite primary key if needed)
DO $$ 
BEGIN
  -- Check if there's a primary key constraint
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'business_members' 
    AND constraint_type = 'PRIMARY KEY'
  ) THEN
    -- Drop the existing primary key
    ALTER TABLE business_members DROP CONSTRAINT business_members_pkey;
  END IF;
  
  -- Add new primary key on id
  ALTER TABLE business_members 
  ALTER COLUMN id SET NOT NULL,
  ADD PRIMARY KEY (id);
EXCEPTION WHEN others THEN
  -- If something goes wrong, continue
  RAISE NOTICE 'Could not update primary key: %', SQLERRM;
END $$;

-- Add unique constraint on (business_id, user_id) if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'business_members_business_id_user_id_key'
  ) THEN
    ALTER TABLE business_members ADD CONSTRAINT business_members_business_id_user_id_key UNIQUE (business_id, user_id);
  END IF;
EXCEPTION WHEN duplicate_object THEN
  -- Constraint already exists, ignore
  NULL;
END $$;

-- Set accepted_at for existing rows
UPDATE business_members 
SET accepted_at = COALESCE(accepted_at, NOW())
WHERE accepted_at IS NULL;

-- Drop existing RLS policies for business_members
DROP POLICY IF EXISTS "Users can view business members for their businesses" ON business_members;
DROP POLICY IF EXISTS "Only owners/admins can insert members" ON business_members;
DROP POLICY IF EXISTS "Only owners/admins can update members" ON business_members;
DROP POLICY IF EXISTS "Only owners/admins can delete members, owners cannot be removed" ON business_members;

-- Policy 1: Users can see memberships for businesses they belong to
CREATE POLICY "Users can view business members for their businesses"
ON business_members
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM business_members bm2
    WHERE bm2.business_id = business_members.business_id
    AND bm2.user_id = auth.uid()
  )
);

-- Policy 2: Only owners/admins can insert new memberships
CREATE POLICY "Only owners/admins can insert members"
ON business_members
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM business_members bm2
    WHERE bm2.business_id = business_members.business_id
    AND bm2.user_id = auth.uid()
    AND bm2.role IN ('owner', 'admin')
  )
);

-- Policy 3: Only owners/admins can update memberships
CREATE POLICY "Only owners/admins can update members"
ON business_members
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM business_members bm2
    WHERE bm2.business_id = business_members.business_id
    AND bm2.user_id = auth.uid()
    AND bm2.role IN ('owner', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM business_members bm2
    WHERE bm2.business_id = business_members.business_id
    AND bm2.user_id = auth.uid()
    AND bm2.role IN ('owner', 'admin')
  )
);

-- Policy 4: Only owners/admins can delete memberships, but owners cannot be removed (except by themselves)
CREATE POLICY "Only owners/admins can delete members, owners cannot be removed"
ON business_members
FOR DELETE
USING (
  -- Check if the deleter is an owner/admin
  EXISTS (
    SELECT 1 FROM business_members bm2
    WHERE bm2.business_id = business_members.business_id
    AND bm2.user_id = auth.uid()
    AND bm2.role IN ('owner', 'admin')
  )
  -- Additional check: owners cannot be removed by others
  AND (
    -- If the member being deleted is an owner, they can only be deleted by themselves
    (business_members.role = 'owner' AND business_members.user_id = auth.uid())
    -- If not an owner, anyone (owner/admin) can delete
    OR business_members.role != 'owner'
  )
);

-- Migration: Auto-add existing business owners as members if not already members
INSERT INTO business_members (business_id, user_id, role, accepted_at, created_at)
SELECT 
  b.id as business_id,
  b.owner_id as user_id,
  'owner' as role,
  NOW() as accepted_at,
  NOW() as created_at
FROM businesses b
WHERE b.owner_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM business_members bm
  WHERE bm.business_id = b.id
  AND bm.user_id = b.owner_id
)
ON CONFLICT (business_id, user_id) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_business_members_business_id ON business_members(business_id);
CREATE INDEX IF NOT EXISTS idx_business_members_user_id ON business_members(user_id);
CREATE INDEX IF NOT EXISTS idx_business_members_role ON business_members(role);