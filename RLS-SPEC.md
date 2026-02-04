# RLS (Row Level Security) Spec — Mise Command Center

## Problem
ALL tables have RLS DISABLED. Every authenticated user can see everything — Mom sees Alex's tasks, agents see private data, etc.

## Supabase Info
- **Project:** `hrgluluiwjqgcybswiha`
- **Dashboard:** https://supabase.com/dashboard/project/hrgluluiwjqgcybswiha

## User IDs
| User | ID | Role |
|---|---|---|
| Alex | `79020c01-aa0b-4719-b697-8c0767b80c2b` | admin, human |
| Lesley (Mom) | `ad3e0539-6c9a-4747-9c5a-8a6a8f6353c8` | human |
| Ax | `d6c2fbde-5639-4944-b0ed-e13cbbd64c03` | ai_agent |
| Tony | `a40862c9-50bf-4c3a-8084-3f750f99febf` | ai_agent |

## Current Spaces
| Space | ID | Owner |
|---|---|---|
| Faithstone | `b5b0d5a5-3968-459f-a747-b74e518cff21` | Alex |
| Personal (Alex) | `13fe98f4-97ba-4f1b-8b04-d4c08f5d1648` | Alex |

## Core Principle
**Access is determined by space membership.** If you're a member of a space, you can see that space's data. The `space_members` table is the source of truth.

## Tables That Need RLS

### 1. `spaces`
- **Enable RLS:** YES
- **SELECT:** User can see spaces where they have a row in `space_members`
- **INSERT:** Any authenticated user can create a space
- **UPDATE:** Only `owner` or `admin` role in `space_members`
- **DELETE:** Only `owner` role in `space_members`

```sql
ALTER TABLE spaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view spaces they belong to"
  ON spaces FOR SELECT
  USING (id IN (SELECT space_id FROM space_members WHERE user_id = auth.uid()));

CREATE POLICY "Authenticated users can create spaces"
  ON spaces FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Space owners/admins can update"
  ON spaces FOR UPDATE
  USING (id IN (SELECT space_id FROM space_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));

CREATE POLICY "Space owners can delete"
  ON spaces FOR DELETE
  USING (id IN (SELECT space_id FROM space_members WHERE user_id = auth.uid() AND role = 'owner'));
```

### 2. `space_members`
- **SELECT:** Can see members of spaces you belong to
- **INSERT:** Owner/admin of the space can add members
- **UPDATE:** Owner/admin can change roles
- **DELETE:** Owner/admin can remove members (but not remove last owner)

```sql
ALTER TABLE space_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view members of their spaces"
  ON space_members FOR SELECT
  USING (space_id IN (SELECT space_id FROM space_members WHERE user_id = auth.uid()));

CREATE POLICY "Space owners/admins can add members"
  ON space_members FOR INSERT
  WITH CHECK (space_id IN (SELECT space_id FROM space_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));

CREATE POLICY "Space owners/admins can update member roles"
  ON space_members FOR UPDATE
  USING (space_id IN (SELECT space_id FROM space_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));

CREATE POLICY "Space owners/admins can remove members"
  ON space_members FOR DELETE
  USING (space_id IN (SELECT space_id FROM space_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));
```

### 3. `tasks`
- **Has `space_id` column:** YES
- **Has `created_by` column:** YES
- **SELECT:** User can see tasks in their spaces, OR tasks assigned to them, OR tasks they created
- **INSERT:** Authenticated + must belong to the space
- **UPDATE:** Same as SELECT
- **DELETE:** Creator or space owner/admin

```sql
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tasks in their spaces or assigned to them"
  ON tasks FOR SELECT
  USING (
    space_id IN (SELECT space_id FROM space_members WHERE user_id = auth.uid())
    OR assignee_id = auth.uid()
    OR created_by = auth.uid()
  );

CREATE POLICY "Users can create tasks in their spaces"
  ON tasks FOR INSERT
  WITH CHECK (
    space_id IS NULL
    OR space_id IN (SELECT space_id FROM space_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update tasks in their spaces"
  ON tasks FOR UPDATE
  USING (
    space_id IN (SELECT space_id FROM space_members WHERE user_id = auth.uid())
    OR assignee_id = auth.uid()
    OR created_by = auth.uid()
  );

CREATE POLICY "Users can delete their own tasks or as space admin"
  ON tasks FOR DELETE
  USING (
    created_by = auth.uid()
    OR space_id IN (SELECT space_id FROM space_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
  );
```

### 4. `documents`
- **Has `space_id` column:** YES
- **Has `created_by` column:** YES
- **SELECT:** User can see docs in their spaces OR docs they created
- **INSERT/UPDATE/DELETE:** Similar pattern

```sql
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view docs in their spaces or own docs"
  ON documents FOR SELECT
  USING (
    space_id IN (SELECT space_id FROM space_members WHERE user_id = auth.uid())
    OR created_by = auth.uid()
  );

CREATE POLICY "Users can create docs in their spaces"
  ON documents FOR INSERT
  WITH CHECK (
    space_id IS NULL
    OR space_id IN (SELECT space_id FROM space_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update docs in their spaces or own docs"
  ON documents FOR UPDATE
  USING (
    space_id IN (SELECT space_id FROM space_members WHERE user_id = auth.uid())
    OR created_by = auth.uid()
  );

CREATE POLICY "Users can delete own docs or as space admin"
  ON documents FOR DELETE
  USING (
    created_by = auth.uid()
    OR space_id IN (SELECT space_id FROM space_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
  );
```

### 5. `projects`
- **Has `space_id` column:** YES
- **Has `created_by` column:** YES

```sql
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view projects in their spaces"
  ON projects FOR SELECT
  USING (
    space_id IN (SELECT space_id FROM space_members WHERE user_id = auth.uid())
    OR created_by = auth.uid()
  );

CREATE POLICY "Users can create projects in their spaces"
  ON projects FOR INSERT
  WITH CHECK (
    space_id IS NULL
    OR space_id IN (SELECT space_id FROM space_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update projects in their spaces"
  ON projects FOR UPDATE
  USING (
    space_id IN (SELECT space_id FROM space_members WHERE user_id = auth.uid())
    OR created_by = auth.uid()
  );

CREATE POLICY "Space owners/admins can delete projects"
  ON projects FOR DELETE
  USING (
    created_by = auth.uid()
    OR space_id IN (SELECT space_id FROM space_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
  );
```

### 6. `inbox`
- **Has `user_id` column:** YES (the sender)
- **Has `space_id` column:** YES (optional)
- **Has `to_recipient` and `from_agent` columns:** YES
- **Rule:** Users see messages they sent OR received OR in their spaces

```sql
ALTER TABLE inbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own messages"
  ON inbox FOR SELECT
  USING (
    user_id = auth.uid()
    OR (space_id IS NOT NULL AND space_id IN (SELECT space_id FROM space_members WHERE user_id = auth.uid()))
  );

CREATE POLICY "Users can create messages"
  ON inbox FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own messages"
  ON inbox FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own messages"
  ON inbox FOR DELETE
  USING (user_id = auth.uid());
```

### 7. `notes`
- **Has `owner_id` column:** YES
- **Private by default** — only the owner sees their notes

```sql
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD their own notes"
  ON notes FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());
```

### 8. `ai_work_log`
- **Public read** — everyone can see AI activity
- **Only AI agents write**

```sql
ALTER TABLE ai_work_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view work log"
  ON ai_work_log FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert"
  ON ai_work_log FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
```

### 9. `agent_chat`
- **Users see their own chat messages**

```sql
ALTER TABLE agent_chat ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own agent chats"
  ON agent_chat FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create agent chat messages"
  ON agent_chat FOR INSERT
  WITH CHECK (user_id = auth.uid());
```

### 10. `users` (profiles)
- **Everyone can see basic profiles** (needed for avatars, names)
- **Only update your own**

```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by authenticated users"
  ON users FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (id = auth.uid());
```

## Tables That Can Stay Open (or skip for now)
- `businesses`, `business_members` — legacy, being replaced by spaces
- `content_items`, `content_prompts`, `content_templates` — content pipeline (low priority)
- `products`, `sales` — business data (scope to space later)
- `calendar_events` — scope to user
- `shopping_list_items` — scope to user
- `notifications` — scope to user
- `task_comments`, `task_files`, `document_comments` — inherit from parent

## Important: Also Recreate Mom's Personal Space
After RLS is applied, create a Personal space for Mom (Lesley):

```sql
INSERT INTO spaces (name, created_by, is_default) 
VALUES ('Personal', 'ad3e0539-6c9a-4747-9c5a-8a6a8f6353c8', true);

-- Then add her as owner (use the space ID from above insert)
INSERT INTO space_members (space_id, user_id, role) 
VALUES ('<new_space_id>', 'ad3e0539-6c9a-4747-9c5a-8a6a8f6353c8', 'owner');
```

## Also: Assign Existing Data to Spaces
Many tasks/docs currently have `space_id = NULL`. After RLS, those become invisible. Either:
1. Set them all to Faithstone's space_id: `b5b0d5a5-3968-459f-a747-b74e518cff21`
2. Or update the policies to allow NULL space_id items to be visible to their creator

**The policies above handle this** — they include `OR created_by = auth.uid()` fallbacks.

## Migration File
Save as: `supabase/migrations/20260203_enable_rls_all_tables.sql`
Run via Supabase dashboard SQL editor or `supabase db push`.
