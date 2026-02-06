# Project Journal + Playbooks - System Spec

**Status:** Draft
**Author:** Ax
**Date:** 2026-02-06

---

## Overview

Restructure projects from fragmented tabs (docs/tasks/files) to a cohesive **Project Journal** with **Playbooks** for repeatable procedures.

## Core Concepts

### 1. Project Journal (Feed)
- Chronological feed of all project activity
- Post updates with text, attachments, linked tasks
- Auto-posts for checklist progress, file uploads, etc.

### 2. Pinned Resources
- Top section of project page
- Quick access to key docs, links, playbooks, files
- Drag to reorder

### 3. Playbooks
- Reusable step-by-step procedure templates
- Can be "run" by assigning to someone
- Progress tracked, notes per step
- Lives at Space level (reusable across projects)

### 4. Checklist Runs
- Instance of a playbook being executed
- Assigned to a person
- Shows in project feed as it progresses

---

## Data Model

### Existing Tables (keep)
```sql
-- projects (modify slightly)
-- tasks (keep as-is, can link to updates)
-- documents (keep, can be pinned)
```

### New Tables

```sql
-- Project Updates (the feed)
CREATE TABLE project_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES users(id) ON DELETE SET NULL,
  content TEXT, -- rich text / markdown
  update_type VARCHAR(30) DEFAULT 'post', 
    -- 'post', 'checklist_started', 'checklist_progress', 'checklist_completed', 'file_added', 'system'
  metadata JSONB DEFAULT '{}', -- flexible data (checklist_run_id, file_ids, task_ids, etc)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Pinned Resources
CREATE TABLE project_pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  title VARCHAR(255) NOT NULL,
  pin_type VARCHAR(20) NOT NULL, -- 'doc', 'link', 'file', 'playbook'
  resource_id UUID, -- references docs/playbooks/files if internal
  url TEXT, -- external link if applicable
  position INT DEFAULT 0,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Playbooks (templates)
CREATE TABLE playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID REFERENCES spaces(id) ON DELETE CASCADE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  icon VARCHAR(50) DEFAULT 'ClipboardList',
  color VARCHAR(20),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Playbook Steps
CREATE TABLE playbook_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id UUID REFERENCES playbooks(id) ON DELETE CASCADE NOT NULL,
  position INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT, -- instructions, can include markdown
  resources JSONB DEFAULT '[]', -- [{type: 'doc'|'link', title: '', url: '', doc_id: ''}]
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Checklist Runs (playbook instances)
CREATE TABLE checklist_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id UUID REFERENCES playbooks(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'completed', 'cancelled'
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Step Progress (per run)
CREATE TABLE checklist_step_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES checklist_runs(id) ON DELETE CASCADE NOT NULL,
  step_id UUID REFERENCES playbook_steps(id) ON DELETE CASCADE NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  UNIQUE(run_id, step_id)
);
```

---

## UI Layout

### Project Page
```
┌─────────────────────────────────────────────────────────────┐
│ [← Back]  📁 Project Name                    [⚙️ Settings]  │
│           Short description                                  │
│           Status: Active    Owner: Alex                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 📌 PINNED RESOURCES                              [+ Add]    │
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐               │
│ │📄 Doc  │ │🔗 Link │ │📋 Play-│ │📁 File │               │
│ │Login   │ │Amazon  │ │book    │ │Report  │               │
│ │Creds   │ │Seller  │ │DMCA    │ │.xlsx   │               │
│ └────────┘ └────────┘ └────────┘ └────────┘               │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 📝 Write an update...                                   │ │
│ │                                                         │ │
│ │ [📎 Attach] [📋 Playbook] [✅ Task] [📄 Doc]    [Post] │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ─────────────────── TODAY ──────────────────────────────── │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 👤 Alex · 2h ago                                    [⋮] │ │
│ │                                                         │ │
│ │ Found another counterfeit seller. Mom, please run the   │ │
│ │ takedown playbook.                                      │ │
│ │                                                         │ │
│ │ 📋 Started: DMCA Takedown Playbook                      │ │
│ │    → Assigned to: Mom                                   │ │
│ │    → Progress: 0/5 steps                                │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 📋 Mom · 1h ago                              [Checklist] │ │
│ │                                                         │ │
│ │ ✅ Completed step 3/5: "File DMCA report"               │ │
│ │ Note: "Report #TKD-2026-0892 submitted"                 │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 📋 Mom · 15m ago                             [Checklist] │ │
│ │                                                         │ │
│ │ 🎉 Completed: DMCA Takedown Playbook                    │ │
│ │    All 5 steps finished!                                │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ─────────────────── YESTERDAY ─────────────────────────── │
│ ...                                                         │
└─────────────────────────────────────────────────────────────┘
```

### Playbook View (when opened)
```
┌─────────────────────────────────────────────────────────────┐
│ [← Back to Project]                                         │
│                                                             │
│ 📋 DMCA Takedown Playbook                                   │
│ Step-by-step process for filing counterfeit takedowns       │
│                                                             │
│ Assigned to: Mom          Progress: ███████░░░ 3/5          │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ✅ Step 1: Screenshot the listing                           │
│    Save screenshot to the project folder                    │
│    └─ 📁 Screenshots folder                                 │
│    Completed · "Got 3 screenshots"                          │
│                                                             │
│ ✅ Step 2: Log into Amazon Brand Registry                   │
│    Use the credentials doc                                  │
│    └─ 📄 Amazon Login Credentials                           │
│    Completed                                                │
│                                                             │
│ ✅ Step 3: File the DMCA report                             │
│    Fill out all required fields                             │
│    └─ 🔗 Amazon Report Infringement                         │
│    Completed · "Report #TKD-2026-0892"                      │
│                                                             │
│ ⬜ Step 4: Update tracking spreadsheet                      │
│    Add new row with report details                          │
│    └─ 📄 Takedown Tracker Sheet                             │
│    [Mark Complete] [Add Note]                               │
│                                                             │
│ ⬜ Step 5: Set follow-up reminder                           │
│    Check back in 48 hours                                   │
│    [Mark Complete] [Add Note]                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Playbooks Library (Space Level)
```
┌─────────────────────────────────────────────────────────────┐
│ 📋 Playbooks                                    [+ Create]  │
│ Reusable procedures for your team                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 📋 DMCA Takedown                              5 steps   │ │
│ │ Process for filing counterfeit takedowns                │ │
│ │ Used 12 times · Last run: 2 days ago                    │ │
│ │                                        [Edit] [Run ▾]   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 📋 New Product Launch                         8 steps   │ │
│ │ Checklist for launching a new product                   │ │
│ │ Used 3 times · Last run: 2 weeks ago                    │ │
│ │                                        [Edit] [Run ▾]   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 📋 Content Review Process                     4 steps   │ │
│ │ Mom's approval workflow for new content                 │ │
│ │ Used 47 times · Last run: yesterday                     │ │
│ │                                        [Edit] [Run ▾]   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Database + Basic Feed (2-3 hours)
- [ ] Create new tables (project_updates, project_pins)
- [ ] Project page with update feed (post + view)
- [ ] Basic update composer (text only first)

### Phase 2: Pinned Resources (1-2 hours)
- [ ] Add pins section to project page
- [ ] Pin docs, links, files
- [ ] Drag to reorder

### Phase 3: Playbooks Core (3-4 hours)
- [ ] Create playbooks + playbook_steps tables
- [ ] Playbooks library page (space level)
- [ ] Create/edit playbook UI
- [ ] Add steps with linked resources

### Phase 4: Checklist Runs (2-3 hours)
- [ ] Create checklist_runs + checklist_step_progress tables
- [ ] "Run playbook" flow - assign to user, pick project
- [ ] Checklist execution view
- [ ] Mark steps complete, add notes
- [ ] Auto-post progress to project feed

### Phase 5: Polish + Integration (2-3 hours)
- [ ] Update composer attachments (files, tasks, playbooks)
- [ ] Notifications for assignments
- [ ] Activity indicators
- [ ] Mobile-friendly layout

---

## Migration Plan

1. Keep existing tasks system (still useful for standalone tasks)
2. Keep existing documents (become pinnable resources)
3. New projects default to Journal view
4. Old project data stays accessible

---

## Questions to Resolve

1. **Tasks**: Keep separate tasks page, or only create from updates?
   - Recommendation: Keep tasks, but encourage creating from updates

2. **Documents**: Separate docs page, or only through projects?
   - Recommendation: Keep docs browsable, but primary access through project pins

3. **Files/Attachments**: Where do uploaded files live?
   - Recommendation: Simple file storage, files attached to updates or pinned

---

## Tech Notes

- Use existing Supabase setup
- Real-time subscriptions for feed updates
- Consider Tiptap for rich text in Phase 5+
- RLS: Updates visible to space members, same pattern as docs
