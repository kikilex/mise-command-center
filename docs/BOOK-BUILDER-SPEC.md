# Book Builder Spec

## Overview
Add a "Book" tab to projects that enables structured book creation with chapters, outlines, and manuscript export. Designed for Faithstone's publishing workflow with full AI automation support.

---

## Core Concepts

### Book Structure
```
Book (Project with book_enabled = true)
├── Front Matter (optional sections)
│   ├── Title Page
│   ├── Copyright
│   ├── Dedication
│   ├── Table of Contents (auto-generated)
│   └── Introduction/Foreword
├── Parts (optional grouping)
│   └── Chapters
│       ├── Chapter 1
│       ├── Chapter 2
│       └── ...
└── Back Matter (optional sections)
    ├── Appendix
    ├── Glossary
    ├── Bibliography
    └── About the Author
```

### Chapter = Doc
- Each chapter IS a document (uses existing `documents` table)
- Chapters have additional metadata: `chapter_order`, `part_id`, `word_count`, `chapter_status`
- Full markdown support with our existing editor

---

## Database Schema

### New: `books` table
```sql
CREATE TABLE books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subtitle TEXT,
  author TEXT,
  target_word_count INTEGER, -- Goal (e.g., 50000 words)
  current_word_count INTEGER DEFAULT 0, -- Auto-calculated
  status TEXT DEFAULT 'planning', -- planning, drafting, editing, final
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Front/Back matter flags
  include_toc BOOLEAN DEFAULT true,
  include_title_page BOOLEAN DEFAULT true,
  include_copyright BOOLEAN DEFAULT true,
  
  -- Export settings
  trim_size TEXT DEFAULT '6x9', -- 5x8, 6x9, 8.5x11
  font_family TEXT DEFAULT 'serif',
  
  UNIQUE(project_id) -- One book per project
);
```

### New: `book_parts` table (optional groupings)
```sql
CREATE TABLE book_parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID REFERENCES books(id) ON DELETE CASCADE,
  title TEXT NOT NULL, -- "Part I: The Beginning"
  part_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### New: `book_chapters` table
```sql
CREATE TABLE book_chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID REFERENCES books(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  part_id UUID REFERENCES book_parts(id) ON DELETE SET NULL,
  
  chapter_number INTEGER, -- Can be null for unnumbered (intro, etc)
  chapter_order INTEGER NOT NULL, -- For drag-drop ordering
  
  -- Chapter-specific metadata
  chapter_type TEXT DEFAULT 'chapter', -- chapter, prologue, epilogue, appendix, front_matter, back_matter
  synopsis TEXT, -- Brief summary for outline view
  notes TEXT, -- Author notes (not in final book)
  pov_character TEXT, -- For fiction
  setting TEXT, -- For fiction
  
  -- Status tracking
  status TEXT DEFAULT 'idea', -- idea, outline, draft, revision, final
  target_word_count INTEGER,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Modify: `documents` table
Add optional field:
```sql
ALTER TABLE documents ADD COLUMN word_count INTEGER DEFAULT 0;
```

---

## UI Components

### 1. Book Tab (in Project view)
Shows when project has a book. Three sub-views:

#### a) Outline View (Default)
- Hierarchical tree: Parts → Chapters
- Each chapter shows: number, title, status chip, word count, synopsis preview
- Drag-drop to reorder
- Click to expand inline synopsis/notes
- Quick-add chapter button

#### b) Manuscript View
- Full scrollable manuscript preview
- All chapters rendered in order
- Read-only (click chapter to edit in doc view)
- Word count in corner

#### c) Progress View
- Visual progress bar (current vs target words)
- Chapter status breakdown (pie chart or bars)
- Daily/weekly word count graph (if we track history)
- Milestone markers

### 2. Chapter Card (in Outline View)
```
┌─────────────────────────────────────────────────────────────┐
│ ⋮⋮  Ch. 3: Breaking the Chains                    [Draft ▼] │
│     "Sarah confronts her past and finds freedom"            │
│     ─────────────────────────────────────────────           │
│     📝 2,847 words    🎯 3,500 target    ████████░░ 81%     │
│     [Edit] [Notes] [⋯]                                      │
└─────────────────────────────────────────────────────────────┘
```

### 3. Add Chapter Modal
- Title (becomes doc title)
- Chapter type dropdown (Chapter, Prologue, Epilogue, Appendix, etc.)
- Synopsis (optional)
- Target word count (optional)
- Assign to Part (if parts exist)
- Auto-creates document linked to chapter

### 4. Book Settings Panel
- Title, Subtitle, Author
- Target word count
- Front/back matter toggles
- Export settings (trim size, font)

### 5. Export Modal
- Format: PDF, EPUB, DOCX, Markdown
- Include front matter? (checkboxes)
- Include back matter?
- Chapter heading style
- Preview button → opens in new tab

---

## Workflow Examples

### Creating a Book
1. Go to project (e.g., "SWP Extended Edition")
2. Click "Enable Book" or project already has book tab
3. Set book title, author, target word count
4. Start adding chapters

### Adding Chapters
1. Click "+ Add Chapter"
2. Enter: "Chapter 1: Spiritual Warfare Foundations"
3. Add synopsis: "Introduction to the concept of spiritual warfare"
4. Set target: 3,000 words
5. Click Create → Doc is created, chapter linked
6. Click chapter to open doc editor

### AI Automation Flow
1. Task created: "Write Chapter 5: Prayer for Protection"
2. Matthew picks up task
3. Matthew creates chapter via API or UI
4. Matthew writes content in doc
5. Matthew sets status to "draft"
6. Task moves to review
7. Mom/Alex reviews, approves
8. Chapter status → "final"

### Exporting
1. Click "Export Book"
2. Select format (PDF for print, EPUB for ebook)
3. Toggle front/back matter sections
4. Click Export
5. Download compiled manuscript

---

## API Endpoints (for agent automation)

```
POST /api/books
  - Create book for project

GET /api/books/:id
  - Get book with chapters

POST /api/books/:id/chapters
  - Add chapter (auto-creates doc)

PATCH /api/books/:id/chapters/:chapterId
  - Update chapter metadata, reorder

POST /api/books/:id/chapters/reorder
  - Bulk reorder chapters

GET /api/books/:id/export?format=pdf
  - Generate and download manuscript
```

---

## Implementation Phases

### Phase 1: Core (Day 1)
- [x] Database tables + migrations
- [x] Book tab in project view
- [x] Outline view with chapters
- [x] Add/edit chapter modal
- [x] Link chapters to docs
- [x] Drag-drop reordering

### Phase 2: Polish (Day 2)
- [ ] Word count tracking (trigger on doc save)
- [ ] Progress visualization
- [ ] Chapter status workflow
- [ ] Manuscript preview view
- [ ] Book settings panel

### Phase 3: Export (Day 3)
- [ ] Markdown export (compile all chapters)
- [ ] PDF export (with formatting)
- [ ] EPUB export (for ebooks)
- [ ] Front/back matter generation

### Phase 4: Automation (Ongoing)
- [ ] API endpoints for agents
- [ ] Task integration (chapter = task?)
- [ ] Auto-assign chapters to Matthew

---

## Design Notes

### Colors / Status Chips
- **Idea**: Gray
- **Outline**: Blue  
- **Draft**: Yellow/Orange
- **Revision**: Purple
- **Final**: Green

### Icons
- Book: 📖 or Lucide `Book`
- Chapter: 📄 or Lucide `FileText`
- Part: 📁 or Lucide `Folder`
- Word count: Lucide `Type` or `LetterText`
- Export: Lucide `Download`

### Drag Handle
- Use `⋮⋮` (grip dots) on left of chapter cards
- Same pattern as phase items

---

## For Prayer Books Specifically

Since Faithstone's books are prayer collections:
- "Chapter" = Section (e.g., "Prayers for Protection")
- Each prayer could be a sub-item OR just content within the chapter doc
- Could add `prayer_count` field for tracking

Example structure:
```
SWP Extended Edition
├── Introduction
├── Part I: Foundations
│   ├── Ch 1: Understanding Spiritual Warfare (5 prayers)
│   ├── Ch 2: Putting on the Armor (7 prayers)
├── Part II: Protection
│   ├── Ch 3: Prayers for Protection (10 prayers)
│   ├── Ch 4: Prayers Against Attack (8 prayers)
...
```

---

## Questions for Alex
1. Do we want Parts (groupings) or just flat chapter list?
2. For prayer books: track individual prayers or just sections?
3. Export priority: PDF first? Or EPUB for ebook sales?
4. Should chapters auto-create tasks for assigned agent?
